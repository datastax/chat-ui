import {isRequestOptions} from "openai/core";
import {HF_TOKEN} from "$env/static/private";

class MessagesEnhancer {
    constructor(originalMessages) {
        this.originalMessages = originalMessages;
    }


    // iterate args
    list(
        threadId: string,
        query?: MessageListParams,
        options?: Core.RequestOptions,
    );
    list(threadId: string, options?: Core.RequestOptions): Core.PagePromise<ThreadMessagesPage, ThreadMessage>;
    list(
        threadId: string,
        query: MessageListParams | Core.RequestOptions = {},
        options?: Core.RequestOptions,
    ): Any {
        let result;
        if (isRequestOptions(query)) {
            return this.list(threadId, {}, query);
        }
        if (options?.stream === true) {
            query["stream"] = true
            try {
                result = this._client.get(`/threads/${threadId}/messages`, {
                    query,
                    ...options,
                    headers: {'OpenAI-Beta': 'assistants=v1', ...options?.headers},
                });
            }
            catch (e) {
                console.log(e)
            }
        }
        else {
            result = this.originalMessages.list(...args);
        }

        // Assume the result is a promise and add custom post-call logic
        return result.then(data => {
            console.log("After calling the original list method");
            // Optionally modify the data or just pass it through
            return data;
        });
    }
}


function enhanceMessages(messages) {
    const enhancer = new MessagesEnhancer(messages);

    return new Proxy(enhancer, {
        get(target, prop, receiver) {
            // If the property exists on the enhancer, return it
            if (prop in target) {
                try {
                    return Reflect.get(target, prop, receiver);
                } catch (e) {
                    console.error(e);
                }
            }
            else {
                return Reflect.get(messages, prop, receiver);
            }
        }
    });
}


export async function getPatchedOpenAI(
    options: ClientOptions,
    model: string
) {
    const base_url = process.env.base_url;

    if (options.baseURL == undefined) {
        if (base_url !== undefined) {
            options.baseURL = base_url;
        } else {
            options.baseURL = "https://api.openai.com/v1";
        }
    }
    let astraApiToken = process.env.ASTRA_API_TOKEN;

    if (astraApiToken == undefined) {
        // throw an error
        throw new Error("ASTRA_API_TOKEN is missing")
    }
    if (options.defaultHeaders == undefined) {
        options.defaultHeaders = {};
    }

    options.defaultHeaders = Object.assign({}, options.defaultHeaders,
    {
        'astra-api-token': astraApiToken,
    });
    if (model !== undefined) {
        if (model.startsWith("huggingface")) {
            options.defaultHeaders = Object.assign({}, options.defaultHeaders,
                {
                    'api-key': HF_TOKEN,
                });
        }
    }



    let client
    let OpenAI;
    try {
        OpenAI = (await import("openai")).OpenAI;
    } catch (e) {
        throw new Error("Failed to import OpenAI", {cause: e});
    }
    client = new OpenAI({...options})

    client.beta.threads.messages = enhanceMessages(client.beta.threads.messages);
    return client
}
