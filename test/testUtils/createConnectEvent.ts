type ConnectEvent = {
    requestContext: {
        connectionId: string;
    };
    headers: {
        Authorization: string;
    };
    body?: any;
};

export function createConnectEvent(
    overrides: Partial<ConnectEvent> = {},
): ConnectEvent {
    return {
        requestContext: {
            connectionId: "connectionId",
            ...(overrides.requestContext || {}),
        },
        headers: {
            Authorization: "Bearer mock.jwt.token",
            ...(overrides.headers || {}),
        },
        ...(overrides.body !== undefined ? { body: overrides.body } : {}),
    };
}
