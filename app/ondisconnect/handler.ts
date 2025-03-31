import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient } from "@/utility";

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
        console.error("WSK-91");
        return {
            statusCode: 400,
            body: {
                error: "WSK-91",
            },
        };
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
        console.error("WSK-92");
        return {
            statusCode: 500,
            body: {
                error: "WSK-92",
            },
        };
    }
};
