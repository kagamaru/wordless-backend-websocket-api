import { APIResponse } from "@/@types";

export function verifyErrorResponse(
    response: APIResponse<unknown>,
    expectedStatusCode: number,
    expectedErrorCode: string,
) {
    expect(response.statusCode).toBe(expectedStatusCode);
    expect(response.body).toEqual({ error: expectedErrorCode });
}
