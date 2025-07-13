import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import MockDate from "mockdate";
import { EmojiString, PostEmoteCorePayload } from "@/@types";
import { onPostEmoteCore } from "@/app/onPostEmote/core";
import { verifyErrorResponse } from "@/test/testUtils";

const ddbMock = mockClient(DynamoDBDocumentClient);

const usersTableName = "users-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";

type TestSetupOptions = {
    userGet: "ok" | "notFound" | "fail";
    emoteReactionPut: "ok" | "fail";
};

let getRDSDBClientInsertQueryMock = jest.fn();
let getRDSDBClientSelectQueryMock = jest.fn();
jest.mock("@/utility", () => {
    const actual = jest.requireActual("@/utility");
    return {
        ...actual,
        getRDSDBClient: jest.fn(() => ({
            query: async (sql: string, params: any[]) => {
                if (sql.includes("SELECT")) {
                    await getRDSDBClientSelectQueryMock(sql, params);
                    return [
                        {
                            sequence_number: 2,
                            emote_id: "mock-guid",
                            emote_reaction_id: "mock-guid",
                            user_id: "mock-user-id",
                            emote_datetime: "2025-07-02 15:06:22",
                            emote_emoji1: ":rat:",
                            emote_emoji2: undefined,
                            emote_emoji3: undefined,
                            emote_emoji4: undefined,
                            is_deleted: 0,
                        },
                    ];
                } else if (sql.includes("INSERT")) {
                    await getRDSDBClientInsertQueryMock(sql, params);
                }
            },
            end: () => {},
        })),
    };
});

jest.mock("guid-typescript", () => ({
    Guid: {
        create: () => "mock-guid",
    },
}));

const testSetUp = ({ userGet, emoteReactionPut }: TestSetupOptions) => {
    const userDdbGetMock = ddbMock.on(GetCommand, {
        TableName: usersTableName,
    });
    const emoteReactionDdbPutMock = ddbMock.on(PutCommand, {
        TableName: emoteReactionTableName,
    });

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

    switch (emoteReactionPut) {
        case "ok":
            emoteReactionDdbPutMock.resolves({});
            break;
        case "fail":
            emoteReactionDdbPutMock.rejects(new Error());
            break;
    }
};

interface OnPostEmoteEventBodyParams {
    userId: "mock-user-id";
    emoteEmoji1: EmojiString;
    emoteEmoji2?: EmojiString;
    emoteEmoji3?: EmojiString;
    emoteEmoji4?: EmojiString;
}

const getOnPostEmoteCoreEventBody = (
    requestBody?: OnPostEmoteEventBodyParams,
): PostEmoteCorePayload => {
    if (!requestBody) {
        return {
            userId: "mock-user-id",
            emoteEmoji1: ":rat:",
            emoteEmoji2: undefined,
            emoteEmoji3: undefined,
            emoteEmoji4: undefined,
        };
    }
    return {
        userId: requestBody.userId,
        emoteEmoji1: requestBody.emoteEmoji1,
        emoteEmoji2: requestBody.emoteEmoji2,
        emoteEmoji3: requestBody.emoteEmoji3,
        emoteEmoji4: requestBody.emoteEmoji4,
    };
};

beforeEach(() => {
    MockDate.set(new Date("2025-07-02 15:06:22"));
});

afterEach(() => {
    MockDate.reset();
    ddbMock.reset();
    getRDSDBClientInsertQueryMock = jest.fn();
    getRDSDBClientSelectQueryMock = jest.fn();
    getRDSDBClientInsertQueryMock.mockClear();
    getRDSDBClientSelectQueryMock.mockClear();
});

describe("エモート投稿時", () => {
    describe("正常系", () => {
        beforeEach(() => {
            testSetUp({
                userGet: "ok",
                emoteReactionPut: "ok",
            });
        });

        describe("エモートの絵文字が1文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody(),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: undefined,
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [
                        "mock-guid",
                        "mock-guid",
                        "mock-user-id",
                        "2025-07-02 15:06:22",
                        ":rat:",
                        undefined,
                        undefined,
                        undefined,
                    ],
                );
                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が2文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: undefined,
                        emoteEmoji4: undefined,
                    }),
                );

                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [
                        "mock-guid",
                        "mock-guid",
                        "mock-user-id",
                        "2025-07-02 15:06:22",
                        ":rat:",
                        ":cow:",
                        undefined,
                        undefined,
                    ],
                );
                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が3文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: undefined,
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: undefined,
                    }),
                );

                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [
                        "mock-guid",
                        "mock-guid",
                        "mock-user-id",
                        "2025-07-02 15:06:22",
                        ":rat:",
                        ":cow:",
                        ":tiger:",
                        undefined,
                    ],
                );
                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        describe("エモートの絵文字が4文字の時", () => {
            test("200を返す", async () => {
                const response = await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: ":rabbit:",
                    }),
                );

                expect(response.statusCode).toBe(200);
            });

            test("DBに対してインサートを行うクエリが実行される", async () => {
                await onPostEmoteCore(
                    getOnPostEmoteCoreEventBody({
                        userId: "mock-user-id",
                        emoteEmoji1: ":rat:",
                        emoteEmoji2: ":cow:",
                        emoteEmoji3: ":tiger:",
                        emoteEmoji4: ":rabbit:",
                    }),
                );

                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledWith(
                    `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                    [
                        "mock-guid",
                        "mock-guid",
                        "mock-user-id",
                        "2025-07-02 15:06:22",
                        ":rat:",
                        ":cow:",
                        ":tiger:",
                        ":rabbit:",
                    ],
                );
                expect(getRDSDBClientInsertQueryMock).toHaveBeenCalledTimes(1);
            });
        });

        test("EmoteReactionTableに対して空のデータが登録される", async () => {
            testSetUp({
                userGet: "ok",
                emoteReactionPut: "ok",
            });

            await onPostEmoteCore(getOnPostEmoteCoreEventBody());

            expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
                TableName: emoteReactionTableName,
                Item: {
                    emoteReactionId: "mock-guid",
                    emoteReactionEmojis: [],
                },
            });
        });
    });

    describe("異常系", () => {
        test("EmoteTable(RDS)との接続でエラーが発生した時、ステータスコード500とWSK-51を返す", async () => {
            getRDSDBClientInsertQueryMock = jest
                .fn()
                .mockRejectedValue(new Error());
            testSetUp({
                userGet: "ok",
                emoteReactionPut: "ok",
            });

            const response = await onPostEmoteCore(
                getOnPostEmoteCoreEventBody(),
            );

            verifyErrorResponse(response, 500, "WSK-51");
        });

        test("UserTableからデータが取得できないとき、ステータスコード404とWSK-52を返す", async () => {
            testSetUp({
                userGet: "notFound",
                emoteReactionPut: "ok",
            });

            const response = await onPostEmoteCore(
                getOnPostEmoteCoreEventBody(),
            );

            verifyErrorResponse(response, 404, "WSK-52");
        });

        test("UserTableと接続できないとき、ステータスコード500とWSK-53を返す", async () => {
            testSetUp({
                userGet: "fail",
                emoteReactionPut: "ok",
            });

            const response = await onPostEmoteCore(
                getOnPostEmoteCoreEventBody(),
            );

            verifyErrorResponse(response, 500, "WSK-53");
        });

        test("EmoteReactionTableに対してデータが登録できないとき、ステータスコード500とWSK-54を返す", async () => {
            testSetUp({
                userGet: "ok",
                emoteReactionPut: "fail",
            });

            const response = await onPostEmoteCore(
                getOnPostEmoteCoreEventBody(),
            );

            verifyErrorResponse(response, 500, "WSK-54");
        });
    });
});
