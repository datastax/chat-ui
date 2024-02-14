import type { TextGenerationStreamOutput } from "@huggingface/inference";
import type OpenAI from "openai";
import type { Stream } from "openai/streaming";

/**
 * Transform a stream of OpenAI.Chat.ChatCompletion into a stream of TextGenerationStreamOutput
 */
export async function* openAIMessageToTextGenerationStream(
	// TODO fix type and for loop
	completionStream: Stream<any>
) {

	let generatedText = "";
	let tokenId = 0;
	for await (const completion of completionStream) {

		const { data } = completion;
		const content = data[0]?.content[0]?.delta?.value ?? "";
		//const last = choices[0]?.finish_reason === "stop";
		if (content) {
			generatedText = generatedText + content;
		}
		const output: TextGenerationStreamOutput = {
			token: {
				id: tokenId++,
				text: content ?? "",
				logprob: 0,
				special: false,
			},
			generated_text: null,
			details: null,
		};
		yield output;
	}
}