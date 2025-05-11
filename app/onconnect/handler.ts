import dayjs from "dayjs";
import "dayjs/locale/ja";
import { envConfig } from "@/config";
import { APIResponse, APIRequest } from "@/@types";
import {
    createErrorResponse,
    getAuthorizationToken,
    isInvalidRequest,
    putToDynamoDB,
    verifyToken,
} from "@/utility";
import { jwtDecode } from "jwt-decode";

dayjs.locale("ja");

export const connect = async (
    event: APIRequest<undefined>,
): Promise<APIResponse<undefined>> => {
    if (isInvalidRequest(event)) {
        return createErrorResponse(400, "WSK-01");
    }

    const getAuthorizationTokenResult = getAuthorizationToken(event);

    const verifyTokenResult = await verifyToken(getAuthorizationTokenResult);
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
                sub: jwtDecode(getAuthorizationTokenResult).sub,
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
