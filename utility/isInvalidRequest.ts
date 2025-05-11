import { APIRequest } from "@/@types";

export function isInvalidRequest(
    event: APIRequest<any>,
    requiredFields?: string[],
): boolean {
    return (
        !event?.requestContext?.connectionId?.trim() ||
        !event.queryStringParameters?.Authorization ||
        (requiredFields && hasMissingBodyFields(event.body, requiredFields))
    );
}

function hasMissingBodyFields(
    body: Record<string, unknown> | undefined,
    requiredFields: string[],
): boolean {
    if (!body) return true;
    return requiredFields.some((key) => !body[key]);
}
