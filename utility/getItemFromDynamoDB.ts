import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "./getDynamoDBClient";
import { ErrorCode } from "@/@types";

const docClient = getDynamoDBClient();

export async function getItemFromDynamoDB<T>(
    tableName: string,
    key: Record<string, string>,
    notFoundErrorCode: ErrorCode,
    connectionErrorCode: ErrorCode,
): Promise<Record<string, T>> {
    try {
        const result = await docClient.send(
            new GetCommand({
                TableName: tableName,
                Key: key,
            }),
        );
        if (result.Item) {
            return result.Item;
        } else {
            throw new Error("Not Found");
        }
    } catch (error) {
        if (error instanceof Error && error.message === "Not Found") {
            console.error(notFoundErrorCode);
            throw new Error(
                JSON.stringify({
                    statusCode: 404,
                    body: {
                        error: notFoundErrorCode,
                    },
                }),
            );
        }

        console.error(connectionErrorCode);
        throw new Error(
            JSON.stringify({
                statusCode: 500,
                body: {
                    error: connectionErrorCode,
                },
            }),
        );
    }
}
