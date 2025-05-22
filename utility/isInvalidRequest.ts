import { APIRequest } from "@/@types";

export function isInvalidRequest(
    event: APIRequest,
    requiredFields?: string[],
): boolean {
    const body = event.body ? JSON.parse(event.body) : undefined;
    return (
        !event?.requestContext?.connectionId?.trim() ||
        (requiredFields && hasMissingBodyFields(body, requiredFields))
    );
}

function hasMissingBodyFields(
    body: Record<string, unknown> | undefined,
    requiredFields: string[],
): boolean {
    if (!body) return true;
    return requiredFields.some((key) => !body[key]);
}
