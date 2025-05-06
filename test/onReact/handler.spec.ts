import { mockClient } from "aws-sdk-client-mock";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import "aws-sdk-client-mock-jest";
import { onReact } from "@/app/onReact/handler";
import { connect } from "@/app/onconnect/handler";
import { getSigningKeys } from "@/utility";
import { jwtDecode } from "jwt-decode";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableName = "user-connection-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";

jest.mock("@/config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
        EMOTE_REACTION_TABLE: "emote-reaction-table-offline",
    },
    cognitoConfig: {
        COGNITO_USER_POOL_ID: "mock-cognito-user-pool-id",
        COGNITO_REGION: "mock-cognito-region",
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

const testSetUp = (
    isUserConnectionDBSetup: boolean,
    isEmoteReactionDBGetSetup: boolean,
    isEmoteReactionDBPutSetup: boolean,
    isUserConnectionDBNotFoundSetup?: boolean,
    isEmoteReactionDBNotFoundSetup?: boolean,
): void => {
    const userConnectionDdbMock = getDDBMockForCommand(
        "Get",
        userConnectionTableName,
    );
    const emoteReactionDdbGetMock = getDDBMockForCommand(
        "Get",
        emoteReactionTableName,
    );
    const emoteReactionDdbPutMock = getDDBMockForCommand(
        "Put",
        emoteReactionTableName,
    );

    if (isUserConnectionDBSetup) {
        if (isUserConnectionDBNotFoundSetup) {
            userConnectionDdbMock.resolves({
                Item: undefined,
            });
        } else {
            userConnectionDdbMock.resolves({
                Item: {
                    connectionId: "connectionId",
                    timestamp: "2021-01-01 00:00:00",
                    sub: "mock-sub",
                },
            });
        }
    } else {
        userConnectionDdbMock.rejects(new Error());
    }

    if (isEmoteReactionDBGetSetup) {
        if (isEmoteReactionDBNotFoundSetup) {
            emoteReactionDdbGetMock.resolves({
                Item: undefined,
            });
        } else {
            emoteReactionDdbGetMock.resolves({
                Item: {
                    emoteReactionId: "emoteReactionId",
                    emoteReactionEmojis: [
                        {
                            emojiId: ":emojiId:",
                            numberOfReactions: 1,
                            reactedUserIds: ["mock-sub"],
                        },
                    ],
                },
            });
        }
    } else {
        emoteReactionDdbGetMock.rejects(new Error());
    }

    if (isEmoteReactionDBPutSetup) {
        emoteReactionDdbPutMock.resolves({});
    } else {
        emoteReactionDdbPutMock.rejects(new Error());
    }
};

beforeEach(() => {
    ddbMock.reset();
});

describe("リアクション時", () => {
    describe("正常系", () => {
        describe("increment時", () => {
            test("200を返す", async () => {
                testSetUp(true, true, true);

                const response = await onReact({
                    requestContext: {
                        connectionId: "connectionId",
                    },
                    headers: {
                        Authorization: "Bearer mock.jwt.token",
                    },
                    body: {
                        action: "onreact",
                        emoteReactionId: "emoteReactionId",
                        reactedEmojiId: ":emojiId:",
                        reactedUserId: "mock-reacted-user-id",
                        operation: "increment",
                    },
                });

                expect(response.statusCode).toBe(200);
            });

            test("EmoteReactionTableに対してPutのリクエスト(+1)が送付される", async () => {
                testSetUp(true, true, true);

                await onReact({
                    requestContext: {
                        connectionId: "connectionId",
                    },
                    headers: {
                        Authorization: "Bearer mock.jwt.token",
                    },
                    body: {
                        action: "onreact",
                        emoteReactionId: "emoteReactionId",
                        reactedEmojiId: ":emojiId:",
                        reactedUserId: "mock-reacted-user-id",
                        operation: "increment",
                    },
                });

                expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                    TableName: emoteReactionTableName,
                    Item: {
                        emoteReactionId: "emoteReactionId",
                        emoteReactionEmojis: [
                            {
                                emojiId: ":emojiId:",
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
                testSetUp(true, true, true);

                const response = await onReact({
                    requestContext: {
                        connectionId: "connectionId",
                    },
                    headers: {
                        Authorization: "Bearer mock.jwt.token",
                    },
                    body: {
                        action: "onreact",
                        emoteReactionId: "emoteReactionId",
                        reactedEmojiId: ":emojiId:",
                        reactedUserId: "mock-sub",
                        operation: "decrement",
                    },
                });

                expect(response.statusCode).toBe(200);
            });

            test("EmoteReactionTableに対してPutのリクエスト(-1)が送付される", async () => {
                testSetUp(true, true, true);

                await onReact({
                    requestContext: {
                        connectionId: "connectionId",
                    },
                    headers: {
                        Authorization: "Bearer mock.jwt.token",
                    },
                    body: {
                        action: "onreact",
                        emoteReactionId: "emoteReactionId",
                        reactedEmojiId: ":emojiId:",
                        reactedUserId: "mock-sub",
                        operation: "decrement",
                    },
                });

                expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                    TableName: emoteReactionTableName,
                    Item: {
                        emoteReactionId: "emoteReactionId",
                        emoteReactionEmojis: [
                            {
                                emojiId: ":emojiId:",
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
        test("リクエストのrequestContextがフィールドごと存在しない時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact(undefined);

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-21",
            });
        });

        test("リクエストのrequestContextが空の時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: undefined,
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-21",
            });
        });

        test("リクエストのconnectionIdが空文字の時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-21",
            });
        });

        test("リクエストのheaderが空の時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: undefined,
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });
            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-21",
            });
        });

        test("リクエストのAuthorizationが空の時、ステータスコード400とWSK-21を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-21",
            });
        });

        test("アクセストークンが不正の時、ステータスコード401とWSK-22を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "incorrect token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                error: "WSK-22",
            });
        });

        test("キーが取得できない時、ステータスコード401とWSK-23を返す", async () => {
            (getSigningKeys as jest.Mock).mockImplementationOnce(async () =>
                Promise.reject(),
            );
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({
                error: "WSK-23",
            });
        });

        test("JWTデコード処理でエラーが発生した時、ステータスコード401とWSK-24を返す", async () => {
            (jwtDecode as jest.Mock).mockRejectedValueOnce(async () => {
                throw new Error();
            });
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                error: "WSK-24",
            });
        });

        test("デコードされたJWTヘッダーからkeyが取得できない時、ステータスコード401とWSK-25を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(async () => ({
                alg: "RS256",
                typ: "JWT",
                kid: "mock-kid-999",
            }));
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                error: "WSK-25",
            });
        });

        test("UserConnectionTableからデータが取得できないとき、ステータスコード404とWSK-26を返す", async () => {
            testSetUp(true, true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({
                error: "WSK-26",
            });
        });

        test("UserConnectionTableと接続できないとき、ステータスコード500とWSK-27を返す", async () => {
            testSetUp(false, true, true, false);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({
                error: "WSK-27",
            });
        });

        test("EmoteReactionTableからデータが取得できないとき、ステータスコード404とWSK-28を返す", async () => {
            testSetUp(true, true, true, false, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({
                error: "WSK-28",
            });
        });

        test("EmoteReactionTableと接続できないとき、ステータスコード500とWSK-29を返す", async () => {
            testSetUp(true, false, true, false, false);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({
                error: "WSK-29",
            });
        });

        test("既にリアクションしたことがある絵文字に対して「increment」を実行した時、ステータスコード400とWSK-30を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-sub",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-30",
            });
        });

        test("リアクション件数が0件の絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-31を返す", async () => {
            testSetUp(true, true, true);
            getDDBMockForCommand("Get", emoteReactionTableName).resolves({
                Item: {
                    emoteReactionId: "emoteReactionId",
                    emoteReactionEmojis: [
                        {
                            emojiId: ":emojiId:",
                            numberOfReactions: 0,
                            reactedUserIds: [],
                        },
                    ],
                },
            });

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-sub",
                    operation: "decrement",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-31",
            });
        });

        test("リアクションしたことがない絵文字に対して「decrement」を実行した時、ステータスコード400とWSK-32を返す", async () => {
            testSetUp(true, true, true);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "decrement",
                },
            });

            expect(response.statusCode).toBe(400);
            expect(response.body).toEqual({
                error: "WSK-32",
            });
        });

        test("EmoteReactionTableに対してPutのリクエストが失敗した時、ステータスコード500とWSK-33を返す", async () => {
            testSetUp(true, true, false);

            const response = await onReact({
                requestContext: {
                    connectionId: "connectionId",
                },
                headers: {
                    Authorization: "Bearer mock.jwt.token",
                },
                body: {
                    action: "onreact",
                    emoteReactionId: "emoteReactionId",
                    reactedEmojiId: ":emojiId:",
                    reactedUserId: "mock-reacted-user-id",
                    operation: "increment",
                },
            });

            expect(response.statusCode).toBe(500);
            expect(response.body).toEqual({
                error: "WSK-33",
            });
        });
    });
});
