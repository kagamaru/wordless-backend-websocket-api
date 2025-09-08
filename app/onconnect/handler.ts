import dayjs from "dayjs";
import "dayjs/locale/ja";
import { envConfig } from "@/config";
import { APIResponse, ConnectAPIRequest } from "@/@types";
import { createErrorResponse, putToDynamoDB, verifyToken } from "@/utility";

dayjs.locale("ja");

export const connect = async (
    event: ConnectAPIRequest<undefined>,
): Promise<APIResponse<undefined>> => {
    if (
        !event?.requestContext?.connectionId?.trim() ||
        !event.queryStringParameters?.Authorization
    ) {
        return createErrorResponse(400, "WSK-01");
    }

    const authorizationToken = event.queryStringParameters.Authorization;

    const verifyTokenResult = await verifyToken(authorizationToken);
    if (verifyTokenResult.statusCode !== 200) {
        return verifyTokenResult;
    }

    const {
        requestContext: { connectionId },
    } = event;

    try {
        await putToDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            {
                connectionId,
                timestamp: dayjs().format("YYYY-MM-DD HH:mm:ss"),
                sub: verifyTokenResult.body.sub,
            },
            "WSK-02",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
    };
};
