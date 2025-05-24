import {
    DeleteCommand,
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { mockClient } from "aws-sdk-client-mock";
import { jwtDecode } from "jwt-decode";
import { onReact } from "@/app/onReact/handler";
import { getSigningKeys } from "@/utility";
import { verifyErrorResponse } from "@/test/testUtils";
import { APIRequest } from "@/@types";

const ddbMock = mockClient(DynamoDBDocumentClient);
const apiMock = mockClient(ApiGatewayManagementApiClient);

const userConnectionTableName = "user-connection-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";

type TestSetupOptions = {
    userConnectionGet: "ok" | "notFound" | "fail";
    userConnectionScan: "ok" | "notFound" | "fail";
    userConnectionDelete: "ok" | "fail";
    emoteReactionGet: "ok" | "notFound" | "fail";
    emoteReactionPut: "ok" | "fail";
    apiPostToConnection: "ok" | "fail";
};

const testSetUp = ({
    userConnectionGet,
    userConnectionScan,
    userConnectionDelete,
    emoteReactionGet,
    emoteReactionPut,
    apiPostToConnection,
}: TestSetupOptions) => {
    const userConnectionDdbGetMock = ddbMock.on(GetCommand, {
        TableName: userConnectionTableName,
    });
    const userConnectionScanDdbMock = ddbMock.on(ScanCommand, {
        TableName: userConnectionTableName,
    });
    const userConnectionDeleteDdbMock = ddbMock.on(DeleteCommand, {
        TableName: userConnectionTableName,
    });
    const emoteReactionDdbGetMock = ddbMock.on(GetCommand, {
        TableName: emoteReactionTableName,
    });
    const emoteReactionDdbPutMock = ddbMock.on(PutCommand, {
        TableName: emoteReactionTableName,
    });

    switch (userConnectionGet) {
        case "ok":
            userConnectionDdbGetMock.resolves({
                Item: {
                    connectionId: "connectionId",
                    timestamp: "2021-01-01 00:00:00",
                    sub: "mock-sub",
                },
            });
            break;
        case "notFound":
            userConnectionDdbGetMock.resolves({
                Item: undefined,
            });
            break;
        case "fail":
            userConnectionDdbGetMock.rejects(new Error());
            break;
    }

    switch (userConnectionScan) {
        case "ok":
            userConnectionScanDdbMock.resolves({
                Items: [
                    {
                        connectionId: {
                            S: "connectionId",
                        },
                        timestamp: {
                            S: "2021-01-01 00:00:00",
                        },
                        sub: {
                            S: "mock-sub",
                        },
                    },
                ],
            });
            break;
        case "notFound":
            userConnectionScanDdbMock.resolves({
                Items: [],
            });
            break;
        case "fail":
            userConnectionScanDdbMock.rejects(new Error());
            break;
    }

    switch (userConnectionDelete) {
        case "ok":
            userConnectionDeleteDdbMock.resolves({});
            break;
        case "fail":
            userConnectionDeleteDdbMock.rejects(new Error());
            break;
    }

    switch (emoteReactionGet) {
        case "ok":
            emoteReactionDdbGetMock.resolves({
                Item: {
                    emoteReactionId: "emoteReactionId",
                    emoteReactionEmojis: [
                        {
                            emojiId: ":snake:",
                            numberOfReactions: 1,
                            reactedUserIds: ["mock-sub"],
                        },
                    ],
                },
            });
            break;
        case "notFound":
            emoteReactionDdbGetMock.resolves({
                Item: undefined,
            });
            break;
        case "fail":
            emoteReactionDdbGetMock.rejects(new Error());
            break;
    }

    switch (emoteReactionPut) {
        case "ok":
            emoteReactionDdbPutMock.resolves({});
            break;
        case "fail":
            emoteReactionDdbPutMock.rejects(new Error());
            break;
    }

    switch (apiPostToConnection) {
        case "ok":
            apiMock.on(PostToConnectionCommand).resolves({});
            break;
        case "fail":
            apiMock.on(PostToConnectionCommand).rejects(new Error());
            break;
    }
};

interface OnReactEventBodyParams {
    connectionId?: string;
    action?: "onReact";
    emoteReactionId?: "emoteReactionId";
    reactedUserId?: "mock-reacted-user-id" | "mock-sub";
    operation?: "increment" | "decrement";
    reactedEmojiId?: `:${string}:`;
    authorization?: string;
}

const getOnReactEventBody = ({
    connectionId = "mock-connection-id",
    action = "onReact",
    emoteReactionId = "emoteReactionId",
    reactedUserId = "mock-reacted-user-id",
    operation = "increment",
    reactedEmojiId = ":snake:",
    authorization = "mock-authorization",
}: OnReactEventBodyParams): APIRequest => {
    return {
        requestContext: {
            connectionId,
        },
        body: JSON.stringify({
            action,
            emoteReactionId,
            reactedEmojiId,
            reactedUserId,
            operation,
            Authorization: authorization,
        }),
    };
};

beforeEach(() => {
    ddbMock.reset();
});

describe("リアクション時", () => {
    describe("正常系", () => {
        describe("increment時", () => {
            test("200を返す", async () => {
                testSetUp({
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                const response = await onReact(
                    getOnReactEventBody({
                        reactedUserId: "mock-reacted-user-id",
                        operation: "increment",
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("EmoteReactionTableに対してPutのリクエスト(+1)が送付される", async () => {
                testSetUp({
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                await onReact(
                    getOnReactEventBody({
                        reactedUserId: "mock-reacted-user-id",
                        operation: "increment",
                    }),
                );

                expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                    TableName: emoteReactionTableName,
                    Item: {
                        emoteReactionId: "emoteReactionId",
                        emoteReactionEmojis: [
                            {
                                emojiId: ":snake:",
                                numberOfReactions: 2,
                                reactedUserIds: [
                                    "mock-sub",
                                    "mock-reacted-user-id",
                                ],
                            },
                        ],
                    },
                });
            });
        });
    });

    describe("decrement時", () => {
        test("200を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-sub",
                    operation: "decrement",
                }),
            );

            expect(response.statusCode).toBe(200);
        });

        test("EmoteReactionTableに対してPutのリクエスト(-1)が送付される", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-sub",
                    operation: "decrement",
                }),
            );

            expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                TableName: emoteReactionTableName,
                Item: {
                    emoteReactionId: "emoteReactionId",
                    emoteReactionEmojis: [
                        {
                            emojiId: ":snake:",
                            numberOfReactions: 0,
                            reactedUserIds: [],
                        },
                    ],
                },
            });
        });
    });

    describe("異常系", () => {
        describe.each([
            [
                "requestContext がフィールドごと存在しない",
                {
                    action: "onReact",
                    emoteReactionId: "emoteReactionId",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                    reactedEmojiId: ":snake:",
                    authorization: "mock-authorization",
                },
            ],
            [
                "requestContext が空",
                {
                    ...getOnReactEventBody({}),
                    requestContext: undefined,
                },
            ],
            [
                "connectionIdが空文字",
                getOnReactEventBody({
                    connectionId: "",
                }),
            ],
            [
                "actionが空",
                {
                    ...getOnReactEventBody({}),
                    body: JSON.stringify({ action: undefined }),
                },
            ],
            [
                "emoteReactionIdが空",
                {
                    ...getOnReactEventBody({}),
                    body: JSON.stringify({ emoteReactionId: undefined }),
                },
            ],
            [
                "reactedUserIdが空",
                {
                    ...getOnReactEventBody({}),
                    body: JSON.stringify({ reactedUserId: undefined }),
                },
            ],
            [
                "operationが空",
                {
                    ...getOnReactEventBody({}),
                    body: JSON.stringify({ operation: undefined }),
                },
            ],
            [
                "reactedEmojiIdが空",
                {
                    ...getOnReactEventBody({}),
                    body: JSON.stringify({ reactedEmojiId: undefined }),
                },
            ],
            [
                "Authorizationが空",
                getOnReactEventBody({
                    authorization: "",
                }),
            ],
        ])("不正なリクエスト：%s", (_, event) => {
            test("WSK-21を返す", async () => {
                testSetUp({
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                // NOTE: テストのためasで強制的にキャストする
                const response = await onReact(event as APIRequest);

                verifyErrorResponse(response, 400, "WSK-21");
            });
        });

        test("不正な絵文字IDが指定された時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                    reactedEmojiId: ":mock-invalid-emoji-id:",
                }),
            );

            verifyErrorResponse(response, 400, "WSK-21");
        });

        test("キーが取得できない時、ステータスコード500とAUN-01を返す", async () => {
            (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
                Promise.reject(),
            );
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "AUN-01");
        });

        test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-02を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => {
                throw new Error();
            });
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 401, "AUN-02");
        });

        test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とAUN-03を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => ({
                alg: "RS256",
                typ: "JWT",
                kid: "mock-kid-999",
            }));
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 401, "AUN-03");
        });

        test("既に存在するUserConnectionTableのデータとsubが一致しないとき、ステータスコード401とAUN-04を返す", async () => {
            (jwtDecode as jest.Mock)
                .mockImplementationOnce(() => ({
                    alg: "RS256",
                    typ: "JWT",
                    kid: "mock-kid-123",
                }))
                .mockImplementationOnce(() => ({
                    sub: "mock-sub-2",
                }));
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 401, "AUN-04");
        });

        test("UserConnectionTableからデータが取得できないとき、ステータスコード404とWSK-22を返す", async () => {
            testSetUp({
                userConnectionGet: "notFound",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 404, "WSK-22");
        });

        test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-23を返す", async () => {
            testSetUp({
                userConnectionGet: "fail",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "WSK-23");
        });

        test("EmoteReactionTableからデータが取得できないとき、ステータスコード404とWSK-24を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "notFound",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 404, "WSK-24");
        });

        test("EmoteReactionTableと接続できないとき、ステータスコード500とWSK-25を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "fail",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "WSK-25");
        });

        test("既にリアクションしたことがある絵文字に対して「increment」を実行した時、ステータスコード400とWSK-26を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-sub",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 400, "WSK-26");
        });

        test("リアクション件数が0件の絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-28を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });
            ddbMock
                .on(GetCommand, {
                    TableName: emoteReactionTableName,
                })
                .resolves({
                    Item: {
                        emoteReactionId: "emoteReactionId",
                        emoteReactionEmojis: [
                            {
                                emojiId: ":snake:",
                                numberOfReactions: 0,
                                reactedUserIds: [],
                            },
                        ],
                    },
                });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-sub",
                    operation: "decrement",
                }),
            );

            verifyErrorResponse(response, 400, "WSK-28");
        });

        test("リアクションしたことがない絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-29を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "decrement",
                }),
            );

            verifyErrorResponse(response, 400, "WSK-29");
        });

        test("EmoteReactionTableに対してPutのリクエストが失敗した時、ステータスコード500とWSK-30を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "fail",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "WSK-30");
        });

        test("UserConnectionTableからデータを全件取得して0件だった時、ステータスコード500とWSK-31を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "notFound",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 404, "WSK-31");
        });

        test("UserConnectionTableに対して全件取得しようとして接続できない時、ステータスコード500とWSK-32を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "fail",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "WSK-32");
        });

        test("API Gatewayと接続できない時、ステータスコード500とWSK-33を返す", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "fail",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            verifyErrorResponse(response, 500, "WSK-33");
        });

        test("UserConnectionTableからデータの削除に失敗した時、エラーにはしない", async () => {
            testSetUp({
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "fail",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onReact(
                getOnReactEventBody({
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                }),
            );

            expect(response.statusCode).toBe(200);
        });
    });
});
