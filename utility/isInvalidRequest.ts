export function isInvalidRequest(
    event: any,
    requiredFields?: string[],
): boolean {
    return (
        !event?.requestContext?.connectionId?.trim() ||
        !event.headers?.Authorization ||
        (requiredFields
            ? hasMissingBodyFields(event.body, requiredFields)
            : false)
    );
}

function hasMissingBodyFields(body: any, requiredFields: string[]): boolean {
    return requiredFields.some((key) => !body?.[key]);
}
