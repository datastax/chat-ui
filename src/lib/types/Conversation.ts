import type { ObjectId } from "bson";
import type { Message } from "./Message";
import type { Timestamps } from "./Timestamps";
import type { User } from "./User";
import type { Assistant } from "./Assistant";

export interface Conversation extends Timestamps {
	_id: ObjectId;

	thread_id?: string;

	sessionId?: string;
	userId?: User["_id"];

	model: string;
	embeddingModel: string;

	title: string;
	messages: Message[];

	meta?: {
		fromShareId?: string;
	};

	preprompt?: string;
	assistantId?: Assistant["_id"];
}
