import { mockClient } from "aws-sdk-client-mock";
import { jwtDecode } from "jwt-decode";
import { connect } from "@/app/onconnect/handler";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSigningKeys } from "@/utility";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableName = "user-connection-table-offline";

jest.mock("@/config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
    },
}));

const mockSigningKeys = {
    "mock-kid-123": {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        n: "test-modulus-base64url",
        e: "AQAB",
    },
    "mock-kid-456": {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        n: "another-test-modulus",
        e: "AQAB",
    },
};
jest.mock("@/utility", () => ({
    ...jest.requireActual("@/utility"),
    getSigningKeys: jest.fn(async () => mockSigningKeys),
}));
jest.mock("jwt-decode", () => ({
    jwtDecode: jest.fn(() => ({
        alg: "RS256",
        typ: "JWT",
        kid: "mock-kid-123",
    })),
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
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        // Assert
        expect(response.statusCode).toBe(200);
    });
});

describe("異常系", () => {
    test("リクエストのrequestContextがフィールドごと存在しない時、ステータスコード400とWSK-01を返す", async () => {
        testSetUp(true);

        const response = await connect(undefined);

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "WSK-01",
        });
    });

    test("リクエストのrequestContextが空の時、ステータスコード400とWSK-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            requestContext: undefined,
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "WSK-01",
        });
    });

    test("リクエストのconnectionIdが空文字の時、ステータスコード400とWSK-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "",
            },
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "WSK-01",
        });
    });

    test("リクエストのheaderが空の時、ステータスコード400とWSK-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "WSK-01",
        });
    });

    test("リクエストのAuthorizationが空の時、ステータスコード400とWSK-01を返す", async () => {
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "",
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "WSK-01",
        });
    });

    test("アクセストークンが不正の時、ステータスコード401とWSK-02を返す", async () => {
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "incorrect token",
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            error: "WSK-02",
        });
    });

    test("キーが取得できない時、ステータスコード401とWSK-03を返す", async () => {
        (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
            Promise.reject(),
        );
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "WSK-03",
        });
    });

    test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とWSK-04を返す", async () => {
        (jwtDecode as jest.Mock).mockImplementationOnce(async () => ({
            alg: "RS256",
            typ: "JWT",
            kid: "mock-kid-999",
        }));
        testSetUp(true);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            error: "WSK-04",
        });
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-05を返す", async () => {
        testSetUp(false);

        const response = await connect({
            requestContext: {
                connectionId: "connectionId",
            },
            headers: {
                Authorization: "Bearer mock.jwt.token",
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "WSK-05",
        });
    });
});
