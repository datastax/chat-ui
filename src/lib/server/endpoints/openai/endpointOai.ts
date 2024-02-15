import { z } from "zod";
import { getPatchedOpenAI } from "./patch"
import { openAICompletionToTextGenerationStream } from "./openAICompletionToTextGenerationStream";
import { openAIChatToTextGenerationStream } from "./openAIChatToTextGenerationStream";
import { buildPrompt } from "$lib/buildPrompt";
import {ASTRA_API_TOKEN, OPENAI_API_KEY} from "$env/static/private";
import type { Endpoint } from "../endpoints";
import { format } from "date-fns";
import {fail} from "@sveltejs/kit";
import {openAIMessageToTextGenerationStream} from "$lib/server/endpoints/openai/openAIMessageToTextGenerationStream";
import fs from "fs";
import {ObjectId} from "mongodb";

export const endpointOAIParametersSchema = z.object({
	weight: z.number().int().positive().default(1),
	model: z.any(),
	type: z.literal("openai"),
	baseURL: z.string().url().default("https://api.openai.com/v1"),
	apiKey: z.string().default(OPENAI_API_KEY ?? "sk-"),
	completion: z
		.union([z.literal("completions"), z.literal("chat_completions")])
		.default("chat_completions"),
	assistant: z.string().optional(),
	defaultHeaders: z.record(z.string()).optional(),
});

export async function getOpenaiClient() {

	let client
	if (ASTRA_API_TOKEN == undefined) {
		let OpenAI;
		try {
			OpenAI = (await import("openai")).OpenAI;
		} catch (e) {
			throw new Error("Failed to import OpenAI", { cause: e });
		}
		client = new OpenAI({})
	}
	else{
		client = await getPatchedOpenAI({})
	}
	return client
}

export async function getFileNames(file_ids) {
	const client = await getOpenaiClient()

	let fileNames = []
	if (file_ids && file_ids.length > 0 ){
		for (const file_id of file_ids) {
			const file = await client.files.retrieve(file_id)
			fileNames.push(file.filename)
		}
	}
	return fileNames
}
export async function createFile(retrievalFile) {
	const openai = await getOpenaiClient()
	let openai_file
	//todo fix this if
	if (retrievalFile?.name !== "" && retrievalFile?.name !== undefined) {
		const file = retrievalFile

		let buffer = Buffer.from(await file.arrayBuffer())
		fs.writeFile("/tmp/" + file.name, buffer, (err) => {
			if (err) throw err;
		})

		let otherFile = fs.createReadStream("/tmp/" + file.name)

		openai_file = await openai.files.create(
			{
				file: otherFile,
				purpose: 'assistants'
			},
		);
	}
	return openai_file;
}

export async function updateAssistant(args){
	const client = await getOpenaiClient()

	if (args.length > 1) {
		try {
			const set = args[1].$set
			await client.beta.assistants.update(
				set.assistant_id,
				{
					model: set.modelId,
					name: set.name,
					description: set.description,
					instructions: set.preprompt,
					tools: [{"type": "retrieval"}],
					file_ids: set.file_ids ? set.file_ids : [],
					metadata: {},
				}
			)
			return args
		}
		catch (e) {
			console.error(e)
			return fail(400, {error: true, message: (e as Error).message});
		}
	}
	return fail(400, {error: true, message: "missing arguments"});
}
export async function createAssistant(args){
	// get input
	const client = await getOpenaiClient()

	const retrievalFile = args[0].file_ids[0]
	let openai_file
	if (retrievalFile?.name !== undefined && retrievalFile?.name !== '') {
		openai_file = await createFile(retrievalFile);
	}

	if (args.length > 0) {
		try {
			const assistant = await client.beta.assistants.create({
				model: args[0].modelId,
				name: args[0].name,
				description: args[0].description,
				instructions: args[0].preprompt,
				tools: [{"type": "retrieval"}],
				file_ids: openai_file ? [openai_file.id] : [],
				metadata: {},
			})
			console.log(assistant)

			args[0]['assistant_id'] = assistant.id
			args[0].file_ids = openai_file ? [openai_file.id] : []
			return args
		}
		catch (e) {
			console.error(e)
			return fail(400, {error: true, message: (e as Error).message});
		}
	}
	return fail(400, {error: true, message: "not enough args"});
}


export async function endpointOai(
	input: z.input<typeof endpointOAIParametersSchema>
): Promise<Endpoint> {
	const { baseURL, apiKey, completion, model, defaultHeaders, assistant } =
		endpointOAIParametersSchema.parse(input);

	const openai = await getOpenaiClient()

	if (assistant !== undefined) {
		return async ({ conversation }) => {
			try {
				let messages = conversation.messages;

				const messagesOpenAI = messages.map((message) => ({
					role: message.from,
					content: message.content,
				}));


				const thread_id = conversation.thread_id

				await openai.beta.threads.messages.create(
					thread_id,
					messagesOpenAI[messagesOpenAI.length-1],
				)

				let run = await openai.beta.threads.runs.create(
					thread_id,
					{
						"assistant_id": assistant
					}
				)

				while (run.status != 'completed' && run.status != 'failed' && run.status != 'generating') {
					run = await openai.beta.threads.runs.retrieve(
						thread_id,
						run.id
					)
					await new Promise(r => setTimeout(r, 1000));
				}
				//TODO: handle failed
				console.log(run.status)
				const result = await openai.beta.threads.messages.list(
					thread_id,
					{
						stream: true
					}
					,
					{}
				)

				return openAIMessageToTextGenerationStream(
					result
				);
			}
			catch (e) {
				console.log(e)
			}
		};
	}
	else if (completion === "completions") {
		return async ({ conversation }) => {
			return openAICompletionToTextGenerationStream(
				await openai.completions.create({
					model: model.id ?? model.name,
					prompt: await buildPrompt({
						messages: conversation.messages,
						webSearch: conversation.messages[conversation.messages.length - 1].webSearch,
						preprompt: conversation.preprompt,
						model,
					}),
					stream: true,
					max_tokens: model.parameters?.max_new_tokens,
					stop: model.parameters?.stop,
					temperature: model.parameters?.temperature,
					top_p: model.parameters?.top_p,
					frequency_penalty: model.parameters?.repetition_penalty,
				})
			);
		};
	} else if (completion === "chat_completions") {
		return async ({ conversation }) => {
			let messages = conversation.messages;
			const webSearch = conversation.messages[conversation.messages.length - 1].webSearch;

			if (webSearch && webSearch.context) {
				const lastMsg = messages.slice(-1)[0];
				const messagesWithoutLastUsrMsg = messages.slice(0, -1);
				const previousUserMessages = messages.filter((el) => el.from === "user").slice(0, -1);

				const previousQuestions =
					previousUserMessages.length > 0
						? `Previous questions: \n${previousUserMessages
								.map(({ content }) => `- ${content}`)
								.join("\n")}`
						: "";
				const currentDate = format(new Date(), "MMMM d, yyyy");
				messages = [
					...messagesWithoutLastUsrMsg,
					{
						from: "user",
						content: `I searched the web using the query: ${webSearch.searchQuery}. Today is ${currentDate} and here are the results:
						=====================
						${webSearch.context}
						=====================
						${previousQuestions}
						Answer the question: ${lastMsg.content} 
						`,
					},
				];
			}

			const messagesOpenAI = messages.map((message) => ({
				role: message.from,
				content: message.content,
			}));

			return openAIChatToTextGenerationStream(
				await openai.chat.completions.create({
					model: model.id ?? model.name,
					messages: conversation.preprompt
						? [{ role: "system", content: conversation.preprompt }, ...messagesOpenAI]
						: messagesOpenAI,
					stream: true,
					max_tokens: model.parameters?.max_new_tokens,
					stop: model.parameters?.stop,
					temperature: model.parameters?.temperature,
					top_p: model.parameters?.top_p,
					frequency_penalty: model.parameters?.repetition_penalty,
				})
			);
		};
	} else {
		throw new Error("Invalid completion type");
	}
}
