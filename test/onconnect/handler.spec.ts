import { mockClient } from "aws-sdk-client-mock";
import { jwtDecode } from "jwt-decode";
import { connect } from "@/app/onconnect/handler";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSigningKeys } from "@/utility";
import { verifyErrorResponse, createConnectEvent } from "@/test/testUtils";

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

describe("接続時", () => {
    test("正常時、200を返す", async () => {
        // Arrange
        testSetUp(true);

        // Act
        const response = await connect(createConnectEvent());

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
                ...createConnectEvent(),
                requestContext: undefined,
            },
        ],
        [
            "connectionIdが空文字",
            createConnectEvent({
                requestContext: {
                    connectionId: "",
                },
            }),
        ],
        [
            "headerが空",
            {
                ...createConnectEvent(),
                headers: undefined,
            },
        ],
        [
            "Authorization が空",
            createConnectEvent({
                headers: {
                    Authorization: "",
                },
            }),
        ],
    ])("不正なリクエスト：%s", (_, event) => {
        beforeEach(() => {
            testSetUp(true);
        });

        test("WSK-01を返す", async () => {
            const response = await connect(event);

            verifyErrorResponse(response, 400, "WSK-01");
        });
    });

    test("アクセストークンが不正の時、ステータスコード401とAUN-01を返す", async () => {
        testSetUp(true);

        const response = await connect(
            createConnectEvent({
                headers: {
                    Authorization: "incorrect token",
                },
            }),
        );

        verifyErrorResponse(response, 401, "AUN-01");
    });

    test("キーが取得できない時、ステータスコード500とAUN-02を返す", async () => {
        (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
            Promise.reject(),
        );
        testSetUp(true);

        const response = await connect(createConnectEvent());

        verifyErrorResponse(response, 500, "AUN-02");
    });

    test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-03を返す", async () => {
        (jwtDecode as jest.Mock).mockRejectedValueOnce(async () => {
            throw new Error();
        });
        testSetUp(true);

        const response = await connect(createConnectEvent());

        verifyErrorResponse(response, 401, "AUN-03");
    });

    test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とAUN-04を返す", async () => {
        (jwtDecode as jest.Mock).mockImplementationOnce(async () => ({
            alg: "RS256",
            typ: "JWT",
            kid: "mock-kid-999",
        }));
        testSetUp(true);

        const response = await connect(createConnectEvent());

        verifyErrorResponse(response, 401, "AUN-04");
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-02を返す", async () => {
        testSetUp(false);

        const response = await connect(createConnectEvent());

        verifyErrorResponse(response, 500, "WSK-02");
    });
});
