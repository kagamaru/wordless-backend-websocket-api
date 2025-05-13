import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { envConfig } from "@/config";
import { ErrorCode, ScannedUserConnection } from "@/@types";
import { deleteItemFromDynamoDB } from "@/utility/deleteItemFromDynamoDB";

const apiClient = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_ENDPOINT,
});

export async function broadcastToAllConnections<T>(
    connections: Array<ScannedUserConnection>,
    data: T,
    postToConnectionErrorCode: ErrorCode,
    deleteItemFromDynamoDBErrorCode: ErrorCode,
) {
    const results = await Promise.allSettled(
        connections.map(async (conn) => {
            const connectionId = conn.connectionId.S;

            try {
                await apiClient.send(
                    new PostToConnectionCommand({
                        ConnectionId: connectionId,
                        Data: Buffer.from(JSON.stringify(data)),
                    }),
                );
            } catch (error) {
                if (error.statusCode === 410) {
                    await deleteItemFromDynamoDB(
                        envConfig.USER_CONNECTION_TABLE,
                        { connectionId },
                        deleteItemFromDynamoDBErrorCode,
                    );
                } else {
                    console.error(postToConnectionErrorCode);
                    throw new Error(
                        JSON.stringify({
                            statusCode: 500,
                            body: {
                                error: postToConnectionErrorCode,
                            },
                        }),
                    );
                }
            }
        }),
    );

    for (const result of results) {
        if (
            result.status === "rejected" &&
            JSON.parse(result.reason.message).body.error ===
                postToConnectionErrorCode
        ) {
            throw new Error(
                JSON.stringify({
                    statusCode: 500,
                    body: {
                        error: JSON.parse(result.reason.message).body.error,
                    },
                }),
            );
        }
    }
}
