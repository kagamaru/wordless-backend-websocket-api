import { APIRequest } from "@/@types";

export function getAuthorizationToken(event: APIRequest<any>): string {
    return event.queryStringParameters.Authorization;
}
