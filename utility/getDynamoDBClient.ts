import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const getDynamoDBClient = (): DynamoDBDocumentClient => {
    let client = new DynamoDBClient({
        region: "us-west-2",
        credentials: { accessKeyId: "FAKE", secretAccessKey: "FAKE" },
        endpoint: "http://localhost.test:8000",
    });
    if (process.env.DEPLOY_ENV !== "offline") {
        client = new DynamoDBClient({
            region: "us-west-2",
        });
    }
    return DynamoDBDocumentClient.from(client);
};
