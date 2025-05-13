import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ErrorCode } from "@/@types";
import { getDynamoDBClient } from "@/utility/getDynamoDBClient";

const ddbClient = getDynamoDBClient();

export async function scanItemsFromDynamoDB<T>(
    tableName: string,
    notFoundErrorCode: ErrorCode,
    connectionErrorCode: ErrorCode,
): Promise<Array<Record<string, T>>> {
    try {
        const result = await ddbClient.send(
            new ScanCommand({
                TableName: tableName,
            }),
        );
        if (result.Items.length > 0) {
            return result.Items;
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
