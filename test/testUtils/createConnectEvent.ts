import { APIRequest } from "@/@types";

export function createConnectEvent(
    overrides: Partial<APIRequest<any>> = {},
): APIRequest<any> {
    return {
        requestContext: {
            connectionId: "connectionId",
            ...(overrides.requestContext || {}),
        },
        queryStringParameters: {
            Authorization: "Bearer mock.jwt.token",
            ...(overrides.queryStringParameters || {}),
        },
        ...(overrides.body !== undefined ? { body: overrides.body } : {}),
    };
}
