import { APIResponse, ErrorCode } from "@/@types";

export function createErrorResponse(
    statusCode: 400 | 401 | 404 | 500,
    code: ErrorCode,
): APIResponse<undefined> {
    console.error(code);
    return {
        statusCode,
        body: { error: code },
    };
}
