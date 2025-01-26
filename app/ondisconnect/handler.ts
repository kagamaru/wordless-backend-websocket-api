import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient } from "@/utility";

const docClient = getDynamoDBClient();

type DisConnectRequest = {
    body?: {
        connectionId?: string;
    };
};

export const disconnect = async (
    event: DisConnectRequest,
): Promise<APIResponse<undefined>> => {
    if (
        !event.body ||
        !event.body.connectionId ||
        event.body.connectionId.trim() === ""
    ) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-91",
            },
        };
    }
    const { connectionId } = event.body;

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
        return {
            statusCode: 500,
            body: {
                error: "EMT-92",
            },
        };
    }
};
