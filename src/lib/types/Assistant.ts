import type { ObjectId } from "bson";
import type { User } from "./User";
import type { Timestamps } from "./Timestamps";

export interface Assistant extends Timestamps {
	_id: ObjectId;
	assistant_id?: string;
	createdById: User["_id"] | string; // user id or session
	createdByName?: User["username"];
	avatar?: string;
	name: string;
	description?: string;
	modelId: string;
	exampleInputs: string[];
	preprompt: string;
	userCount?: number;
	featured?: boolean;
	file_ids: any[];
}
