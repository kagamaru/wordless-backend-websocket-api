import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ErrorCode } from "@/@types";
import { getDynamoDBClient } from "@/utility/getDynamoDBClient";

const ddbClient = getDynamoDBClient();

export async function deleteItemFromDynamoDB(
    tableName: string,
    key: Record<string, string>,
    errorCode: ErrorCode,
): Promise<void> {
    try {
        await ddbClient.send(
            new DeleteCommand({
                TableName: tableName,
                Key: key,
            }),
        );
    } catch (error) {
        console.error(errorCode);
        throw new Error(
            JSON.stringify({
                statusCode: 500,
                body: {
                    error: errorCode,
                },
            }),
        );
    }
}
