import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { envConfig, webSocketConfig } from "@/config";
import { ErrorCode, ScannedUserConnection } from "@/@types";
import { deleteItemFromDynamoDB } from "@/utility/deleteItemFromDynamoDB";

const apiClient = new ApiGatewayManagementApiClient({
    endpoint: webSocketConfig.WEBSOCKET_ENDPOINT,
});

export async function broadcastToAllConnections<T>(
    connections: Array<ScannedUserConnection>,
    data: T,
    postToConnectionErrorCode: ErrorCode,
    deleteItemFromDynamoDBErrorCode: ErrorCode,
) {
    const results = await Promise.allSettled(
        connections.map(async (conn) => {
            const { connectionId } = conn;

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
                    throw new Error(postToConnectionErrorCode);
                }
            }
        }),
    );

    // NOTE: コネクションの削除に失敗した時はエラーにしない
    for (const result of results) {
        if (
            result.status === "rejected" &&
            result.reason.message === postToConnectionErrorCode
        ) {
            throw new Error(
                JSON.stringify({
                    statusCode: 500,
                    body: {
                        error: result.reason.message,
                    },
                }),
            );
        }
    }
}
