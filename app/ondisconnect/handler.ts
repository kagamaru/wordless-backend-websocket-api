import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { createErrorResponse, deleteItemFromDynamoDB } from "@/utility";

type DisConnectRequest = {
    requestContext: {
        connectionId: string;
    };
};

export const disconnect = async (
    event: DisConnectRequest,
): Promise<APIResponse<undefined>> => {
    if (
        !event.requestContext ||
        !event.requestContext.connectionId ||
        event.requestContext.connectionId.trim() === ""
    ) {
        return createErrorResponse(400, "WSK-91");
    }
    const { connectionId } = event.requestContext;

    try {
        await deleteItemFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            {
                connectionId,
            },
            "WSK-92",
        );
        return {
            statusCode: 200,
        };
    } catch (error) {
        return JSON.parse(error.message);
    }
};
