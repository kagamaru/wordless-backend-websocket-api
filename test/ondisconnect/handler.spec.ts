import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { disconnect } from "@/app/ondisconnect/handler";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableName = "user-connection-table-offline";
const connectionId = "00000000-0000-0000-0000-000000000000";

jest.mock("@/config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
    },
}));

const mockDdbSetup = () => {
    ddbMock
        .on(DeleteCommand, {
            TableName: userConnectionTableName,
            Key: {
                connectionId,
            },
        })
        .resolves({});
};

beforeEach(() => {
    ddbMock.reset();
});

describe("切断時", () => {
    describe("正常系", () => {
        test("200を返す", async () => {
            mockDdbSetup();

            expect(
                (await disconnect({ requestContext: { connectionId } }))
                    .statusCode,
            ).toBe(200);
        });

        test("UserConnectionTableに対して削除のリクエストが送付される", async () => {
            mockDdbSetup();

            await disconnect({ requestContext: { connectionId } });

            expect(ddbMock).toHaveReceivedCommand(DeleteCommand);
        });
    });

    describe("異常系", () => {
        test("リクエストのrequestContextが空であれば、400エラーと WSK-91を返す", async () => {
            mockDdbSetup();

            const response = await disconnect({
                requestContext: undefined,
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-91",
            });
        });

        test("connectionIdが空であれば、400エラーと WSK-91を返す", async () => {
            mockDdbSetup();

            const response = await disconnect({
                requestContext: { connectionId: undefined },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-91",
            });
        });

        test("connectionIdが空文字であれば、400エラーと WSK-91を返す", async () => {
            mockDdbSetup();

            const response = await disconnect({
                requestContext: { connectionId: "" },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-91",
            });
        });

        test("UserConnectionTableと接続できなければ、500エラーとWSK-92を返す", async () => {
            ddbMock
                .on(DeleteCommand, {
                    TableName: userConnectionTableName,
                    Key: {
                        connectionId,
                    },
                })
                .rejects(new Error());

            const response = await disconnect({
                requestContext: { connectionId },
            });

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({
                error: "WSK-92",
            });
        });
    });
});
