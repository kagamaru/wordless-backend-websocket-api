import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ErrorCode } from "@/@types";
import { getDynamoDBClient } from "@/utility/getDynamoDBClient";

const docClient = getDynamoDBClient();

export async function putToDynamoDB<T>(
    tableName: string,
    item: Record<string, T>,
    connectionErrorCode: ErrorCode,
): Promise<void> {
    try {
        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: item,
            }),
        );
    } catch (error) {
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
