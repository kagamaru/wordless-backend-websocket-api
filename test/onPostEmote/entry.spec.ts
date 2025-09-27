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
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { Uint8ArrayBlobAdapter } from "@aws-sdk/util-stream";
import { jwtDecode } from "jwt-decode";
import MockDate from "mockdate";
import { APIRequest, EmojiString } from "@/@types";
import { onPostEmoteEntry } from "@/app/onPostEmote/entry";
import { verifyErrorResponse } from "@/test/testUtils";
import { Emote } from "@/classes/Emote";
import { getSigningKeys } from "@/utility";

const ddbMock = mockClient(DynamoDBDocumentClient);
const apiMock = mockClient(ApiGatewayManagementApiClient);
const lambdaMock = mockClient(LambdaClient);

const userConnectionTableName = "user-connection-table-offline";
const userSubTableName = "user-sub-table-offline";
const userTableName = "user-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";
const postEmoteCoreLambdaName =
    "wordless-backend-websocket-api-offline-post-emote-core";

type TestSetupOptions = {
    userSubGet: "ok" | "notFound" | "fail";
    userConnectionGet: "ok" | "notFound" | "fail";
    userConnectionScan: "ok" | "notFound" | "fail";
    userConnectionDelete: "ok" | "fail";
    userGet: "ok" | "notFound" | "fail";
    emoteReactionPut: "ok" | "fail";
    postEmoteCoreLambdaInvoke: "ok" | "fail";
    apiPostToConnection: "ok" | "fail";
};

let postEmoteCoreLambdaInvokeMockResult = jest.fn(() => {
    return {
        Payload: Uint8ArrayBlobAdapter.fromString(
            JSON.stringify({
                statusCode: 200,
                body: {
                    emote: new Emote(
                        2,
                        "mock-guid",
                        "mock-user-name",
                        "mock-user-id",
                        "2025-07-02 15:06:22",
                        "mock-guid",
                        [
                            {
                                emojiId: ":rat:",
                            },
                            {
                                emojiId: undefined,
                            },
                            {
                                emojiId: undefined,
                            },
                            {
                                emojiId: undefined,
                            },
                        ],
                        "mock-user-avatar-url",
                        [],
                        0,
                    ),
                },
            }),
        ),
    };
});

const testSetUp = ({
    userSubGet,
    userConnectionGet,
    userConnectionScan,
    userConnectionDelete,
    userGet,
    emoteReactionPut,
    postEmoteCoreLambdaInvoke,
    apiPostToConnection,
}: TestSetupOptions) => {
    const userSubDdbGetMock = ddbMock.on(GetCommand, {
        TableName: userSubTableName,
    });
    const userConnectionDdbGetMock = ddbMock.on(GetCommand, {
        TableName: userConnectionTableName,
    });
    const userConnectionScanDdbMock = ddbMock.on(ScanCommand, {
        TableName: userConnectionTableName,
    });
    const userConnectionDeleteDdbMock = ddbMock.on(DeleteCommand, {
        TableName: userConnectionTableName,
    });
    const userDdbGetMock = ddbMock.on(GetCommand, {
        TableName: userTableName,
    });
    const emoteReactionDdbPutMock = ddbMock.on(PutCommand, {
        TableName: emoteReactionTableName,
    });
    const postEmoteCoreLambdaInvokeMock = lambdaMock.on(InvokeCommand, {
        FunctionName: postEmoteCoreLambdaName,
    });

    switch (userSubGet) {
        case "ok":
            userSubDdbGetMock.resolves({
                Item: {
                    userSub: "mock-sub",
                    userId: "mock-user-id",
                },
            });
            break;
        case "notFound":
            userSubDdbGetMock.resolves({
                Item: undefined,
            });
            break;
        case "fail":
            userSubDdbGetMock.rejects(new Error());
            break;
    }

    switch (userGet) {
        case "ok":
            userDdbGetMock.resolves({
                Item: {
                    userId: "mock-user-id",
                    userName: "mock-user-name",
                    userAvatarUrl: "mock-user-avatar-url",
                },
            });
            break;
        case "notFound":
            userDdbGetMock.resolves({
                Item: undefined,
            });
            break;
        case "fail":
            userDdbGetMock.rejects(new Error());
            break;
    }

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

    switch (emoteReactionPut) {
        case "ok":
            emoteReactionDdbPutMock.resolves({});
            break;
        case "fail":
            emoteReactionDdbPutMock.rejects(new Error());
            break;
    }

    switch (postEmoteCoreLambdaInvoke) {
        case "ok":
            postEmoteCoreLambdaInvokeMock.resolves(
                postEmoteCoreLambdaInvokeMockResult(),
            );
            break;
        case "fail":
            postEmoteCoreLambdaInvokeMock.rejects(new Error());
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

interface OnPostEmoteEventBodyParams {
    connectionId?: string;
    action?: "onPostEmote";
    userId?: "mock-user-id";
    emoteEmoji1?: EmojiString;
    emoteEmoji2?: EmojiString;
    emoteEmoji3?: EmojiString;
    emoteEmoji4?: EmojiString;
    authorization?: string;
}

const getOnPostEmoteEventBody = ({
    connectionId = "mock-connection-id",
    action = "onPostEmote",
    userId = "mock-user-id",
    emoteEmoji1 = ":rat:",
    emoteEmoji2,
    emoteEmoji3,
    emoteEmoji4,
    authorization = "mock-authorization",
}: OnPostEmoteEventBodyParams): APIRequest => {
    return {
        requestContext: {
            connectionId,
        },
        body: JSON.stringify({
            action,
            userId,
            emoteEmoji1,
            emoteEmoji2,
            emoteEmoji3,
            emoteEmoji4,
            Authorization: authorization,
        }),
    };
};

beforeEach(() => {
    MockDate.set(new Date("2025-07-02 15:06:22"));
});

afterEach(() => {
    MockDate.reset();
    ddbMock.reset();
    apiMock.reset();
    lambdaMock.reset();
    postEmoteCoreLambdaInvokeMockResult.mockClear();
});

describe("エモート投稿時", () => {
    describe("正常系", () => {
        beforeEach(() => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });
        });

        describe("エモートの絵文字が1文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteEntry(
                    getOnPostEmoteEventBody({}),
                );

                expect(response.statusCode).toBe(200);
            });
        });

        describe("エモートの絵文字が2文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteEntry(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });
        });

        describe("エモートの絵文字が3文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteEntry(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });
        });

        describe("エモートの絵文字が4文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteEntry(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: ":rabbit:",
                    }),
                );

                expect(response.statusCode).toBe(200);
            });
        });

        test("クライアントにデータがブロードキャストされる", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            await onPostEmoteEntry(getOnPostEmoteEventBody({}));

            expect(apiMock).toHaveReceivedCommandWith(PostToConnectionCommand, {
                ConnectionId: {
                    S: "connectionId",
                },
                Data: Buffer.from(
                    JSON.stringify({
                        action: "onPostEmote",
                        emote: new Emote(
                            2,
                            "mock-guid",
                            "mock-user-name",
                            "mock-user-id",
                            "2025-07-02 15:06:22",
                            "mock-guid",
                            [
                                {
                                    emojiId: ":rat:",
                                },
                                {
                                    emojiId: undefined,
                                },
                                {
                                    emojiId: undefined,
                                },
                                {
                                    emojiId: undefined,
                                },
                            ],
                            "mock-user-avatar-url",
                            [],
                            0,
                        ),
                    }),
                ),
            });
        });
    });

    describe("異常系", () => {
        describe.each([
            [
                "requestContext がフィールドごと存在しない",
                {
                    action: "onPostEmote",
                    userId: "mock-user-id",
                    emoteEmoji1: ":rat:",
                    emoteEmoji2: undefined,
                    emoteEmoji3: undefined,
                    emoteEmoji4: undefined,
                    authorization: "mock-authorization",
                },
            ],
            [
                "requestContext が空",
                {
                    ...getOnPostEmoteEventBody({}),
                    requestContext: undefined,
                },
            ],
            [
                "connectionIdが空文字",
                getOnPostEmoteEventBody({
                    connectionId: "",
                }),
            ],
            [
                "actionが空",
                {
                    ...getOnPostEmoteEventBody({}),
                    body: JSON.stringify({ action: undefined }),
                },
            ],
            [
                "userIdが空",
                {
                    ...getOnPostEmoteEventBody({}),
                    body: JSON.stringify({ userId: undefined }),
                },
            ],
            [
                "emoteEmoji1が空",
                {
                    ...getOnPostEmoteEventBody({}),
                    body: JSON.stringify({ emoteEmoji1: undefined }),
                },
            ],
            [
                "Authorizationが空",
                getOnPostEmoteEventBody({
                    authorization: "",
                }),
            ],
        ])("不正なリクエスト：%s", (_, event) => {
            test("WSK-41を返す", async () => {
                testSetUp({
                    userSubGet: "ok",
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    userGet: "ok",
                    emoteReactionPut: "ok",
                    postEmoteCoreLambdaInvoke: "ok",
                    apiPostToConnection: "ok",
                });

                // NOTE: テストのためasで強制的にキャストする
                const response = await onPostEmoteEntry(event as APIRequest);

                verifyErrorResponse(response, 400, "WSK-41");
            });
        });

        test.each([
            {
                emoteEmoji1: ":mock-invalid-emoji-id:",
            },
            {
                emoteEmoji1: ":rat:",
                emoteEmoji2: ":mock-invalid-emoji-id:",
            },
            {
                emoteEmoji1: ":rat:",
                emoteEmoji2: ":cow:",
                emoteEmoji3: ":mock-invalid-emoji-id:",
            },
            {
                emoteEmoji1: ":rat:",
                emoteEmoji2: ":cow:",
                emoteEmoji3: ":tiger:",
                emoteEmoji4: ":mock-invalid-emoji-id:",
            },
        ])(
            "不正な絵文字IDが指定された時、ステータスコード400とWSK-41を返す",
            async (event) => {
                testSetUp({
                    userSubGet: "ok",
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    userGet: "ok",
                    emoteReactionPut: "ok",
                    postEmoteCoreLambdaInvoke: "ok",
                    apiPostToConnection: "ok",
                });

                const response = await onPostEmoteEntry(
                    getOnPostEmoteEventBody(
                        event as OnPostEmoteEventBodyParams,
                    ),
                );

                verifyErrorResponse(response, 400, "WSK-41");
            },
        );

        test.each([
            {
                emoteEmoji1: undefined,
                emoteEmoji2: ":cow:",
                emoteEmoji3: ":tiger:",
                emoteEmoji4: ":rabbit:",
            },
            {
                emoteEmoji1: ":rat:",
                emoteEmoji2: undefined,
                emoteEmoji3: ":tiger:",
                emoteEmoji4: ":rabbit:",
            },
            {
                emoteEmoji1: ":rat:",
                emoteEmoji2: ":cow:",
                emoteEmoji3: undefined,
                emoteEmoji4: ":rabbit:",
            },
        ])(
            "空の絵文字入力（投稿終了）の後、絵文字が指定された時、ステータスコード400とWSK-41を返す",
            async (event) => {
                testSetUp({
                    userSubGet: "ok",
                    userConnectionGet: "ok",
                    userConnectionScan: "ok",
                    userConnectionDelete: "ok",
                    userGet: "ok",
                    emoteReactionPut: "ok",
                    postEmoteCoreLambdaInvoke: "ok",
                    apiPostToConnection: "ok",
                });

                const response = await onPostEmoteEntry({
                    ...getOnPostEmoteEventBody({}),
                    body: JSON.stringify({
                        ...event,
                    }),
                });

                verifyErrorResponse(response, 400, "WSK-41");
            },
        );

        test("キーが取得できない時、ステータスコード500とAUN-01を返す", async () => {
            (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
                Promise.reject(),
            );
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 500, "AUN-01");
        });

        test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-02を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => {
                throw new Error();
            });
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
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
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
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
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 401, "AUN-04");
        });

        test("UserConnectionTableからデータが取得できないとき、ステータスコード404とWSK-42を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "notFound",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 404, "WSK-42");
        });

        test("1件取得時、UserConnectionTableと接続できないとき、ステータスコード500とWSK-43を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "fail",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 500, "WSK-43");
        });

        test("呼び出しているLambda関数の実行に失敗した時、ステータスコード500とWSK-44を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "fail",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 500, "WSK-44");
        });

        test("UserConnectionTableからデータを全件取得して0件だった時、ステータスコード404とWSK-45を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "notFound",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 404, "WSK-45");
        });

        test("UserConnectionTableに対して全件取得しようとして接続できない時、ステータスコード500とWSK-46を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "fail",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 500, "WSK-46");
        });

        test("API Gatewayと接続できない時、ステータスコード500とWSK-47を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "fail",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            verifyErrorResponse(response, 500, "WSK-47");
        });

        test("UserConnectionTableからデータの削除に失敗した時、エラーにはしない", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "fail",
                userGet: "ok",
                emoteReactionPut: "ok",
                postEmoteCoreLambdaInvoke: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmoteEntry(
                getOnPostEmoteEventBody({}),
            );

            expect(response.statusCode).toBe(200);
        });
    });
});
