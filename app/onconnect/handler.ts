import { APIResponse } from "@/@types";

export const connect = async (): Promise<APIResponse<undefined>> => {
    return {
        statusCode: 200,
    };
};
