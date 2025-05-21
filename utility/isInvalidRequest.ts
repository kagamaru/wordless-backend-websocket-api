import { APIRequest } from "@/@types";

export function isInvalidRequest(
    event: APIRequest,
    requiredFields?: string[],
): boolean {
    return (
        !event?.requestContext?.connectionId?.trim() ||
        (requiredFields &&
            hasMissingBodyFields(JSON.parse(event.body), requiredFields))
    );
}

function hasMissingBodyFields(
    body: Record<string, unknown> | undefined,
    requiredFields: string[],
): boolean {
    if (!body) return true;
    return requiredFields.some((key) => !body[key]);
}
