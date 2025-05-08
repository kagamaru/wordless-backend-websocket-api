import { DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { disconnect } from "@/app/ondisconnect/handler";
import { verifyErrorResponse } from "@/test/testUtils";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableName = "user-connection-table-offline";
const connectionId = "00000000-0000-0000-0000-000000000000";

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
        describe.each([
            [
                "requestContext が空",
                {
                    requestContext: undefined,
                },
            ],
            [
                "connectionIdが空",
                {
                    requestContext: { connectionId: undefined },
                },
            ],
            [
                "connectionIdが空文字",
                {
                    requestContext: { connectionId: "" },
                },
            ],
        ])("不正なリクエスト：%s", (_, event) => {
            beforeEach(() => {
                mockDdbSetup();
            });

            test("400エラーとWSK-91を返す", async () => {
                const response = await disconnect(event);

                verifyErrorResponse(response, 400, "WSK-91");
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

                verifyErrorResponse(response, 500, "WSK-92");
            });
        });
    });
});
