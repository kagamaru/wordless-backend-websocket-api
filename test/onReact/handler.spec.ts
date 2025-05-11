import { mockClient } from "aws-sdk-client-mock";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { jwtDecode } from "jwt-decode";
import { onReact } from "@/app/onReact/handler";
import { getSigningKeys } from "@/utility";
import { createConnectEvent, verifyErrorResponse } from "@/test/testUtils";

const ddbMock = mockClient(DynamoDBDocumentClient);

const emoteReactionTableName = "emote-reaction-table-offline";

const getDDBMockForCommand = (command: "Get" | "Put", tableName: string) => {
    if (command === "Get") {
        return ddbMock.on(GetCommand, {
            TableName: tableName,
        });
    }
    return ddbMock.on(PutCommand, {
        TableName: tableName,
    });
};

type TestSetupOptions = {
    userConnection: "ok" | "notFound" | "fail";
    emoteReactionGet: "ok" | "notFound" | "fail";
    emoteReactionPut: "ok" | "fail";
};

const testSetUp = ({
    userConnection,
    emoteReactionGet,
    emoteReactionPut,
}: TestSetupOptions) => {
    const userConnectionDdbMock = getDDBMockForCommand(
        "Get",
        "user-connection-table-offline",
    );
    const emoteReactionDdbGetMock = getDDBMockForCommand(
        "Get",
        emoteReactionTableName,
    );
    const emoteReactionDdbPutMock = getDDBMockForCommand(
        "Put",
        emoteReactionTableName,
    );

    switch (userConnection) {
        case "ok":
            userConnectionDdbMock.resolves({
                Item: {
                    connectionId: "connectionId",
                    timestamp: "2021-01-01 00:00:00",
                    sub: "mock-sub",
                },
            });
            break;
        case "notFound":
            userConnectionDdbMock.resolves({
                Item: undefined,
            });
            break;
        case "fail":
            userConnectionDdbMock.rejects(new Error());
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
};

const getOnReactEventBody = (
    reactedUserId: "mock-reacted-user-id" | "mock-sub",
    operation: "increment" | "decrement",
    reactedEmojiId: `:${string}:` = ":snake:",
) => {
    return {
        body: {
            action: "onReact",
            emoteReactionId: "emoteReactionId",
            reactedEmojiId,
            reactedUserId,
            operation,
        },
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
                    userConnection: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                });

                const response = await onReact(
                    createConnectEvent(
                        getOnReactEventBody(
                            "mock-reacted-user-id",
                            "increment",
                        ),
                    ),
                );

                expect(response.statusCode).toBe(200);
            });

            test("EmoteReactionTableに対してPutのリクエスト(+1)が送付される", async () => {
                testSetUp({
                    userConnection: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                });

                await onReact(
                    createConnectEvent(
                        getOnReactEventBody(
                            "mock-reacted-user-id",
                            "increment",
                        ),
                    ),
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

        describe("decrement時", () => {
            test("200を返す", async () => {
                testSetUp({
                    userConnection: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                });

                const response = await onReact(
                    createConnectEvent(
                        getOnReactEventBody("mock-sub", "decrement"),
                    ),
                );

                expect(response.statusCode).toBe(200);
            });

            test("EmoteReactionTableに対してPutのリクエスト(-1)が送付される", async () => {
                testSetUp({
                    userConnection: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                });

                await onReact(
                    createConnectEvent(
                        getOnReactEventBody("mock-sub", "decrement"),
                    ),
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
    });

    describe("異常系", () => {
        describe.each([
            ["requestContext がフィールドごと存在しない", undefined],
            [
                "requestContext が空",
                {
                    ...createConnectEvent(
                        getOnReactEventBody(
                            "mock-reacted-user-id",
                            "increment",
                        ),
                    ),
                    requestContext: undefined,
                },
            ],
            [
                "connectionIdが空文字",
                createConnectEvent({
                    requestContext: {
                        connectionId: "",
                    },
                    ...getOnReactEventBody("mock-reacted-user-id", "increment"),
                }),
            ],
            [
                "queryStringParametersが空",
                {
                    ...createConnectEvent(
                        getOnReactEventBody(
                            "mock-reacted-user-id",
                            "increment",
                        ),
                    ),
                    queryStringParameters: undefined,
                },
            ],
            [
                "Authorization が空",
                {
                    ...createConnectEvent(
                        getOnReactEventBody(
                            "mock-reacted-user-id",
                            "increment",
                        ),
                    ),
                    queryStringParameters: { Authorization: "" },
                },
            ],
        ])("不正なリクエスト：%s", (_, event) => {
            test("WSK-21を返す", async () => {
                testSetUp({
                    userConnection: "ok",
                    emoteReactionGet: "ok",
                    emoteReactionPut: "ok",
                });

                const response = await onReact(event);

                verifyErrorResponse(response, 400, "WSK-21");
            });
        });

        test("不正な絵文字IDが指定された時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody(
                        "mock-reacted-user-id",
                        "increment",
                        ":mock-invalid-emoji-id:",
                    ),
                ),
            );

            verifyErrorResponse(response, 400, "WSK-21");
        });

        test("キーが取得できない時、ステータスコード401とAUN-02を返す", async () => {
            (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
                Promise.reject(),
            );
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 500, "AUN-02");
        });

        test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-03を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => {
                throw new Error();
            });
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 401, "AUN-03");
        });

        test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とAUN-04を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => ({
                alg: "RS256",
                typ: "JWT",
                kid: "mock-kid-999",
            }));
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 401, "AUN-04");
        });

        test("既に存在するUserConnectionTableのデータとsubが一致しないとき、ステータスコード401とAUN-05を返す", async () => {
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
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 401, "AUN-05");
        });

        test("UserConnectionTableからデータが取得できないとき、ステータスコード404とWSK-22を返す", async () => {
            testSetUp({
                userConnection: "notFound",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 404, "WSK-22");
        });

        test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-23を返す", async () => {
            testSetUp({
                userConnection: "fail",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 500, "WSK-23");
        });

        test("EmoteReactionTableからデータが取得できないとき、ステータスコード404とWSK-24を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "notFound",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 404, "WSK-24");
        });

        test("EmoteReactionTableと接続できないとき、ステータスコード500とWSK-25を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "fail",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 500, "WSK-25");
        });

        test("既にリアクションしたことがある絵文字に対して「increment」を実行した時、ステータスコード400とWSK-26を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-sub", "increment"),
                ),
            );

            verifyErrorResponse(response, 400, "WSK-26");
        });

        test("リアクション件数が0件の絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-28を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });
            getDDBMockForCommand("Get", emoteReactionTableName).resolves({
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
                createConnectEvent(
                    getOnReactEventBody("mock-sub", "decrement"),
                ),
            );

            verifyErrorResponse(response, 400, "WSK-28");
        });

        test("リアクションしたことがない絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-29を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "decrement"),
                ),
            );

            verifyErrorResponse(response, 400, "WSK-29");
        });

        test("EmoteReactionTableに対してPutのリクエストが失敗した時、ステータスコード500とWSK-30を返す", async () => {
            testSetUp({
                userConnection: "ok",
                emoteReactionGet: "ok",
                emoteReactionPut: "fail",
            });

            const response = await onReact(
                createConnectEvent(
                    getOnReactEventBody("mock-reacted-user-id", "increment"),
                ),
            );

            verifyErrorResponse(response, 500, "WSK-30");
        });
    });
});
