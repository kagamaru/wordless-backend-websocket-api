import { envConfig } from "@/config";
import { ErrorCode, FetchedUserConnection } from "@/@types";
import { getItemFromDynamoDB } from "@/utility/getItemFromDynamoDB";

export async function verifyUserConnection(params: {
    connectionId: string;
    sub: string;
    errorCode: [ErrorCode, ErrorCode];
}): Promise<string> {
    let userConnection: FetchedUserConnection;
    try {
        userConnection = (await getItemFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            {
                connectionId: params.connectionId,
            },
            params.errorCode[0],
            params.errorCode[1],
        )) as FetchedUserConnection;
    } catch (error) {
        throw new Error(error.message);
    }

    if (userConnection.sub !== params.sub) {
        throw new Error(
            JSON.stringify({
                statusCode: 401,
                body: {
                    error: "AUN-04",
                },
            }),
        );
    }

    return userConnection.sub;
}
