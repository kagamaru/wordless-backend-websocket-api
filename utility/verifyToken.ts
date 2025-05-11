import { jwtDecode, JwtPayload } from "jwt-decode";
import { getSigningKeys } from "@/utility/getSigningKeys";

export async function verifyToken(token: string): Promise<
    | {
          statusCode: 200;
          body: {
              sub: string;
          };
      }
    | {
          statusCode: 401 | 500;
          body: {
              error: "AUN-02" | "AUN-03" | "AUN-04";
          };
      }
> {
    let keys: { [key: string]: any };
    try {
        keys = await getSigningKeys();
    } catch {
        console.error("AUN-02");
        return {
            statusCode: 500,
            body: {
                error: "AUN-02",
            },
        };
    }

    let decodedHeader: { alg: string; typ: string; kid: string };
    let decodedPayload: JwtPayload;
    try {
        decodedHeader = jwtDecode(token, { header: true });
        decodedPayload = jwtDecode(token);
    } catch {
        console.error("AUN-03");
        return {
            statusCode: 401,
            body: {
                error: "AUN-03",
            },
        };
    }

    const key = keys[decodedHeader.kid];
    if (!key) {
        console.error("AUN-04");
        return {
            statusCode: 401,
            body: {
                error: "AUN-04",
            },
        };
    }

    return {
        statusCode: 200,
        body: {
            sub: decodedPayload.sub,
        },
    };
}
