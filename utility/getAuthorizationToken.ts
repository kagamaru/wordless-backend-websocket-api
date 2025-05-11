import { APIRequest } from "@/@types";

export function getAuthorizationToken(event: APIRequest<any>):
    | string
    | {
          statusCode: 401;
          body: {
              error: "AUN-01";
          };
      } {
    const token =
        event.queryStringParameters?.Authorization?.split("Bearer ")[1];
    if (!token) {
        console.error("AUN-01");
        return {
            statusCode: 401,
            body: {
                error: "AUN-01",
            },
        };
    }
    return token;
}
