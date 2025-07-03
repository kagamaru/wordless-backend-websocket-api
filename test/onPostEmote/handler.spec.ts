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
import MockDate from "mockdate";
import { APIRequest } from "@/@types";
import { onPostEmote } from "@/app/onPostEmote/handler";
import { verifyErrorResponse } from "@/test/testUtils";

const ddbMock = mockClient(DynamoDBDocumentClient);
const apiMock = mockClient(ApiGatewayManagementApiClient);

const userConnectionTableName = "user-connection-table-offline";
const userSubTableName = "user-sub-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";

type TestSetupOptions = {
    userSubGet: "ok" | "notFound" | "fail";
    userConnectionGet: "ok" | "notFound" | "fail";
    userConnectionScan: "ok" | "notFound" | "fail";
    userConnectionDelete: "ok" | "fail";
    emoteReactionPut: "ok" | "fail";
    apiPostToConnection: "ok" | "fail";
};

let getRDSDBClientQueryMock: jest.Mock<any, any, any>;
jest.mock("@/utility", () => {
    const actual = jest.requireActual("@/utility");
    return {
        ...actual,
        getRDSDBClient: jest.fn(() => ({
            query: (sql: string) => getRDSDBClientQueryMock(sql),
            end: () => {},
        })),
    };
});

jest.mock("guid-typescript", () => ({
    Guid: {
        create: () => "mock-guid",
    },
}));

const testSetUp = ({
    userSubGet,
    userConnectionGet,
    userConnectionScan,
    userConnectionDelete,
    emoteReactionPut,
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
    const emoteReactionDdbPutMock = ddbMock.on(PutCommand, {
        TableName: emoteReactionTableName,
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
    emoteEmoji1?: `:${string}:`;
    emoteEmoji2?: `:${string}:`;
    emoteEmoji3?: `:${string}:`;
    emoteEmoji4?: `:${string}:`;
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
    ddbMock.reset();
    apiMock.reset();
    getRDSDBClientQueryMock = jest.fn();
    MockDate.set(new Date("2025-07-02 15:06:22"));
});

afterEach(() => {
    MockDate.reset();
});

describe("エモート投稿時", () => {
    describe("正常系", () => {
        beforeEach(() => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });
        });

        describe("エモートの絵文字が1文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmote(getOnPostEmoteEventBody({}));

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmote(getOnPostEmoteEventBody({}));

                expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES ('mock-guid', 'mock-guid', 'mock-user-id', '2025-07-02 15:06:22', ':rat:', 'null', 'null', 'null', 0)`,
                );
                expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が2文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES ('mock-guid', 'mock-guid', 'mock-user-id', '2025-07-02 15:06:22', ':rat:', ':cow:', 'null', 'null', 0)`,
                );
                expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が3文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: undefined,
                    }),
                );

                expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES ('mock-guid', 'mock-guid', 'mock-user-id', '2025-07-02 15:06:22', ':rat:', ':cow:', ':tiger:', 'null', 0)`,
                );
                expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が4文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: ":rabbit:",
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmote(
                    getOnPostEmoteEventBody({
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: ":rabbit:",
                    }),
                );

                expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES ('mock-guid', 'mock-guid', 'mock-user-id', '2025-07-02 15:06:22', ':rat:', ':cow:', ':tiger:', ':rabbit:', 0)`,
                );
                expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        test("EmoteReactionTableに対して空のデータが登録される", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            await onPostEmote(getOnPostEmoteEventBody({}));

            expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                TableName: emoteReactionTableName,
                Item: {
                    emoteReactionId: "mock-guid",
                    emoteReactionEmojis: [],
                },
            });
        });

        test("クライアントにデータがブロードキャストされる", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            await onPostEmote(getOnPostEmoteEventBody({}));

            expect(apiMock).toHaveReceivedCommandWith(PostToConnectionCommand, {
                ConnectionId: {
                    S: "connectionId",
                },
                Data: Buffer.from(
                    JSON.stringify({
                        action: "onPostEmote",
                        emoteId: "mock-guid",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: undefined,
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                        emoteReactionId: "mock-guid",
                        emoteReactionEmojis: [],
                        totalNumberOfReactions: 0,
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
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                // NOTE: テストのためasで強制的にキャストする
                const response = await onPostEmote(event as APIRequest);

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
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                const response = await onPostEmote(
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
                    emoteReactionPut: "ok",
                    apiPostToConnection: "ok",
                });

                const response = await onPostEmote({
                    ...getOnPostEmoteEventBody({}),
                    body: JSON.stringify({
                        ...event,
                    }),
                });

                verifyErrorResponse(response, 400, "WSK-41");
            },
        );

        test("JWTデコード処理でエラーが発生した時、ステータスコード401とAUN-02を返す", async () => {
            (jwtDecode as jest.Mock).mockImplementationOnce(() => {
                throw new Error();
            });
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 401, "AUN-02");
        });

        test("UserConnectionTableからデータが取得できないとき、ステータスコード404とWSK-42を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "notFound",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 404, "WSK-42");
        });

        test("1件取得時、UserConnectionTableと接続できないとき、ステータスコード500とWSK-43を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "fail",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-43");
        });

        test("1件取得時、UserSubTableからデータが取得できないとき、ステータスコード404とWSK-44を返す", async () => {
            testSetUp({
                userSubGet: "notFound",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 404, "WSK-44");
        });

        test("UserSubTableと接続できないとき、ステータスコード500とWSK-45を返す", async () => {
            testSetUp({
                userSubGet: "fail",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-45");
        });

        test("EmoteTable(RDS)との接続でエラーが発生した時、ステータスコード500とWSK-47を返す", async () => {
            getRDSDBClientQueryMock = jest.fn().mockRejectedValue(new Error());
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });
            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-47");
        });

        test("EmoteReactionTableに対してデータが登録できないとき、ステータスコード500とWSK-48を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "fail",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-48");
        });

        test("UserConnectionTableからデータを全件取得して0件だった時、ステータスコード404とWSK-49を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "notFound",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 404, "WSK-49");
        });

        test("UserConnectionTableに対して全件取得しようとして接続できない時、ステータスコード500とWSK-50を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "fail",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-50");
        });

        test("API Gatewayと接続できない時、ステータスコード500とWSK-51を返す", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "ok",
                emoteReactionPut: "ok",
                apiPostToConnection: "fail",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            verifyErrorResponse(response, 500, "WSK-51");
        });

        test("UserConnectionTableからデータの削除に失敗した時、エラーにはしない", async () => {
            testSetUp({
                userSubGet: "ok",
                userConnectionGet: "ok",
                userConnectionScan: "ok",
                userConnectionDelete: "fail",
                emoteReactionPut: "ok",
                apiPostToConnection: "ok",
            });

            const response = await onPostEmote(getOnPostEmoteEventBody({}));

            expect(response.statusCode).toBe(200);
        });
    });
});
