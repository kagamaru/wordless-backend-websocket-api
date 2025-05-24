export type ConnectAPIRequest<T> = {
    requestContext: {
        connectionId: string;
    };
    queryStringParameters: {
        Authorization: string;
    };
    body?: T;
};
