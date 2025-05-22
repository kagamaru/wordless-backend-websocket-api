import { mockClient } from "aws-sdk-client-mock";
import { jwtDecode } from "jwt-decode";
import { connect } from "@/app/onconnect/handler";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { verifyErrorResponse } from "@/test/testUtils";
import { getSigningKeys } from "@/utility";

const ddbMock = mockClient(DynamoDBDocumentClient);

const testSetUp = (isUserConnectionDBSetup: boolean): void => {
    const userConnectionDdbMock = ddbMock.on(PutCommand, {
        TableName: "user-connection-table-offline",
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

const connectRequest = {
    requestContext: {
        connectionId: "connectionId",
    },
    queryStringParameters: {
        Authorization: "Bearer mock.jwt.token",
    },
};

describe("接続時", () => {
    test("正常時、200を返す", async () => {
        // Arrange
        testSetUp(true);

        // Act
        const response = await connect(connectRequest);

        // Assert
        expect(response.statusCode).toBe(200);
    });
});

describe("異常系", () => {
    describe.each([
        ["requestContext がフィールドごと存在しない", undefined],
        [
            "requestContext が空",
            {
                ...connectRequest,
                requestContext: undefined,
            },
        ],
        [
            "connectionIdが空文字",
            {
                ...connectRequest,
                requestContext: {
                    connectionId: "",
                },
            },
        ],
        [
            "queryStringParametersが空",
            {
                ...connectRequest,
                queryStringParameters: undefined,
            },
        ],
        [
            "Authorization が空",
            {
                ...connectRequest,
                queryStringParameters: {
                    Authorization: "",
                },
            },
        ],
    ])("不正なリクエスト：%s", (_, event) => {
        test("WSK-01を返す", async () => {
            testSetUp(true);

            const response = await connect(event);

            verifyErrorResponse(response, 400, "WSK-01");
        });
    });

    test("キーが取得できない時、ステータスコード500とAUN-01を返す", async () => {
        (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
            Promise.reject(),
        );
        testSetUp(true);

        const response = await connect(connectRequest);

        verifyErrorResponse(response, 500, "AUN-01");
    });

    test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-02を返す", async () => {
        (jwtDecode as jest.Mock).mockImplementationOnce(() => {
            throw new Error();
        });
        testSetUp(true);

        const response = await connect(connectRequest);

        verifyErrorResponse(response, 401, "AUN-02");
    });

    test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とAUN-03を返す", async () => {
        (jwtDecode as jest.Mock).mockImplementationOnce(
            (_token: string, options: any) => {
                if (options.header) {
                    return {
                        alg: "RS256",
                        typ: "JWT",
                        kid: "mock-kid-999",
                    };
                }
                return {
                    sub: "mock-sub",
                };
            },
        );
        testSetUp(true);

        const response = await connect(connectRequest);

        verifyErrorResponse(response, 401, "AUN-03");
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-02を返す", async () => {
        testSetUp(false);

        const response = await connect(connectRequest);

        verifyErrorResponse(response, 500, "WSK-02");
    });
});
