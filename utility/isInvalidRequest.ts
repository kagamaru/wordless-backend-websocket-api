interface Event {
    requestContext?: { connectionId?: string };
    headers?: { Authorization?: string };
    body?: Record<string, unknown>;
}

export function isInvalidRequest(
    event: Event,
    requiredFields?: string[],
): boolean {
    return (
        !event?.requestContext?.connectionId?.trim() ||
        !event.headers?.Authorization ||
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
