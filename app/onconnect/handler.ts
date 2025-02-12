import { PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient } from "@/utility";

const docClient = getDynamoDBClient();

dayjs.locale("ja");

type ConnectRequest = {
    requestContext: {
        connectionId: string;
    };
};

export const connect = async (
    event: ConnectRequest,
): Promise<APIResponse<undefined>> => {
    if (
        !event.requestContext?.connectionId ||
        event.requestContext.connectionId.trim() === ""
    ) {
        console.error("EMT-01");
        return {
            statusCode: 400,
            body: {
                error: "EMT-01",
            },
        };
    }
    const {
        requestContext: { connectionId },
    } = event;

    try {
        await docClient.send(
            new PutCommand({
                TableName: envConfig.USER_CONNECTION_TABLE,
                Item: {
                    connectionId,
                    timestamp: dayjs().toString(),
                },
            }),
        );
    } catch (error) {
        console.error("EMT-02");
        return {
            statusCode: 500,
            body: {
                error: "EMT-02",
            },
        };
    }

    return {
        statusCode: 200,
    };
};
