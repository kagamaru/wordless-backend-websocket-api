export type APIRequest<T> = {
    requestContext: {
        connectionId: string;
    };
    queryStringParameters: {
        Authorization: string;
    };
    body?: T;
};
