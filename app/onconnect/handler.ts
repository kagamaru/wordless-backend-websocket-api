import { PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient, getSigningKeys } from "@/utility";
import { jwtDecode } from "jwt-decode";

const docClient = getDynamoDBClient();

dayjs.locale("ja");

type ConnectRequest = {
    requestContext: {
        connectionId: string;
    };
    headers: {
        Authorization: string;
    };
};

export const connect = async (
    event: ConnectRequest,
): Promise<APIResponse<undefined>> => {
    if (
        !event?.requestContext ||
        !event.requestContext?.connectionId ||
        event.requestContext.connectionId.trim() === "" ||
        !event.headers?.Authorization
    ) {
        console.error("WSK-01");
        return {
            statusCode: 400,
            body: {
                error: "WSK-01",
            },
        };
    }

    const token = event.headers?.Authorization?.split("Bearer ")[1];
    if (!token) {
        console.error("WSK-02");
        return {
            statusCode: 401,
            body: {
                error: "WSK-02",
            },
        };
    }

    let keys: { [key: string]: any };
    try {
        keys = await getSigningKeys();
    } catch {
        console.error("WSK-03");
        return {
            statusCode: 500,
            body: {
                error: "WSK-03",
            },
        };
    }

    const decodedHeader = jwtDecode(token, { header: true });
    const key = keys[decodedHeader.kid];

    if (!key) {
        console.error("WSK-04");
        return {
            statusCode: 401,
            body: {
                error: "WSK-04",
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
                    timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                    sub: jwtDecode(token).sub,
                },
            }),
        );
    } catch (error) {
        console.error("WSK-05");
        return {
            statusCode: 500,
            body: {
                error: "WSK-05",
            },
        };
    }

    return {
        statusCode: 200,
    };
};
