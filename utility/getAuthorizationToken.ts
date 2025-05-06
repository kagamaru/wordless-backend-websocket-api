export function getAuthorizationToken(event: any):
    | string
    | {
          statusCode: 401;
          body: {
              error: "AUN-01";
          };
      } {
    const token = event.headers?.Authorization?.split("Bearer ")[1];
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
