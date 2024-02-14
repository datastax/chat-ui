import {isRequestOptions} from "openai/core";
import type OpenAI from "openai";

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


export function patch(oai: OpenAI){
    oai.beta.threads.messages = enhanceMessages(oai.beta.threads.messages);
    return oai
}
