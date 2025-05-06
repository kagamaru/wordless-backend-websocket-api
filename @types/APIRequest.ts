export type APIRequest<T> = {
    requestContext: {
        connectionId: string;
    };
    headers: {
        Authorization: string;
    };
    body?: T;
};
