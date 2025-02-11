import { mockClient } from "aws-sdk-client-mock";
import { Guid } from "guid-typescript";
import { connect } from "@/app/onconnect/handler";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableName = "user-connection-table-offline";

jest.mock("@/config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
    },
}));

const testSetUp = (isUserConnectionDBSetup: boolean): void => {
    const userConnectionDdbMock = ddbMock.on(PutCommand, {
        TableName: userConnectionTableName,
    });

    if (isUserConnectionDBSetup) {
        userConnectionDdbMock.resolves({});
    } else {
        userConnectionDdbMock.rejects(new Error());
    }

    jest.spyOn(Guid, "create").mockReturnValue(
        Guid.parse("00000000-0000-0000-0000-000000000000"),
    );
};

beforeEach(() => {
    ddbMock.reset();
});

describe("接続時", () => {
    test("正常時、200を返す", async () => {
        // Arrange
        testSetUp(true);

        // Act
        const response = await connect({
            queryStringParameters: {
                userId: "@a",
            },
            requestContext: {
                connectionId: "connectionId",
            },
        });

        // Assert
        expect(response.statusCode).toBe(200);
    });
});

describe("異常系", () => {
    test("リクエストのqueryStringParametersが空の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: undefined,
            requestContext: {
                connectionId: "connectionId",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのuserIdが空の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: {
                userId: undefined,
            },
            requestContext: {
                connectionId: "connectionId",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのuserIdが空文字の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: {
                userId: "",
            },
            requestContext: {
                connectionId: "connectionId",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのrequestContextが空の時、ステータスコード400とEMT-02を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: {
                userId: "@a",
            },
            requestContext: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-02",
        });
    });

    test("リクエストのconnectionIdが空の時、ステータスコード400とEMT-02を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: {
                userId: "@a",
            },
            requestContext: {
                connectionId: "",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-02",
        });
    });

    test("リクエストのconnectionIdが空文字の時、ステータスコード400とEMT-02を返す", async () => {
        testSetUp(true);

        const response = await connect({
            queryStringParameters: {
                userId: "@a",
            },
            requestContext: {
                connectionId: "",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-02",
        });
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とEMT-03を返す", async () => {
        testSetUp(false);

        const response = await connect({
            queryStringParameters: {
                userId: "@a",
            },
            requestContext: {
                connectionId: "connectionId",
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-03",
        });
    });
});
