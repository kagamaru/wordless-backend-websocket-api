import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { createErrorResponse, getDynamoDBClient } from "@/utility";

const docClient = getDynamoDBClient();

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
        await docClient.send(
            new DeleteCommand({
                TableName: envConfig.USER_CONNECTION_TABLE,
                Key: {
                    connectionId,
                },
            }),
        );

        return {
            statusCode: 200,
        };
    } catch (error) {
        return createErrorResponse(500, "WSK-92");
    }
};
