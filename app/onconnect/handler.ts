import { PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient } from "@/utility";

const docClient = getDynamoDBClient();

dayjs.locale("ja");

type ConnectRequest = {
    queryStringParameters?: {
        userId: string;
    };
    requestContext: {
        connectionId: string;
    };
};

export const connect = async (
    event: ConnectRequest,
): Promise<APIResponse<undefined>> => {
    // NOTE: wscatはConnect時のリクエスト渡しをサポートしていないので、offlineでのテスト時はコメントを外す
    // const event = {
    //     queryStringParameters: {
    //         userId: "@fuga_fuga",
    //     },
    // };
    if (
        !event.queryStringParameters?.userId ||
        event.queryStringParameters.userId.trim() === ""
    ) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-01",
            },
        };
    }
    if (
        !event.requestContext?.connectionId ||
        event.requestContext.connectionId.trim() === ""
    ) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-02",
            },
        };
    }
    const {
        queryStringParameters: { userId },
        requestContext: { connectionId },
    } = event;

    try {
        await docClient.send(
            new PutCommand({
                TableName: envConfig.USER_CONNECTION_TABLE,
                Item: {
                    connectionId,
                    userId,
                    timestamp: dayjs().toString(),
                },
            }),
        );
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-03",
            },
        };
    }

    return {
        statusCode: 200,
    };
};
