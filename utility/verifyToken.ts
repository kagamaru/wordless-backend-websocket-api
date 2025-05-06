import { jwtDecode } from "jwt-decode";
import { getSigningKeys } from "@/utility/getSigningKeys";

export async function verifyToken(token: string): Promise<
    | {
          statusCode: 401 | 500;
          body: {
              error: "AUN-02" | "AUN-03" | "AUN-04";
          };
      }
    | "OK"
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
    try {
        decodedHeader = await jwtDecode(token, { header: true });
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

    return "OK";
}
