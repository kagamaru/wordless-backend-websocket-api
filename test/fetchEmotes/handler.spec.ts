import { mockClient } from "aws-sdk-client-mock";
import { fetchEmotes } from "@/app/fetchEmotes/handler";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Emote } from "@/classes/Emote";

const ddbMock = mockClient(DynamoDBDocumentClient);

const userConnectionTableItem = {
    Item: {
        connectionId: "connectionId",
        timestamp: "2025-01-14T22:09:00",
    },
};

const emoteTableItem = [
    {
        sequence_number: 1,
        emote_id: "emoteId-b",
        emote_reaction_id: "emoteReactionId-b",
        user_id: "@b",
        emote_datetime: "2025-01-19 09:00:48",
        emote_emoji1: `:bear:`,
        emote_emoji2: `:bear:`,
        emote_emoji3: `:sad:`,
        emote_emoji4: `:party_parrot:`,
        is_deleted: 0,
    },
    {
        sequence_number: 0,
        emote_id: "emoteId-a",
        emote_reaction_id: "emoteReactionId-a",
        user_id: "@a",
        emote_datetime: "2025-01-18 09:00:48",
        emote_emoji1: `:snake:`,
        emote_emoji2: `:smile:`,
        emote_emoji3: `:smile:`,
        emote_emoji4: `:party_parrot:`,
        is_deleted: 0,
    },
];

const emoteReactionTableItemForUserA = {
    Item: {
        emoteReactionId: "emoteReactionId-a",
        emoteReactionEmojis: [
            {
                emojiId: ":snake:",
                numberOfReactions: 23,
            },
            {
                emojiId: ":smile",
                numberOfReactions: 1,
            },
        ],
    },
};

const emoteReactionTableItemForUserB = {
    Item: {
        emoteReactionId: "emoteReactionId-b",
        emoteReactionEmojis: [
            {
                emojiId: ":party_parrot:",
                numberOfReactions: 100,
            },
        ],
    },
};

const usersTableItemForA = {
    Item: {
        userId: "@a",
        userAvatarUrl: "https://a.png",
        userName: "A",
    },
};

const usersTableItemForB = {
    Item: {
        userId: "@b",
        userAvatarUrl: "https://b.png",
        userName: "B",
    },
};

const userConnectionTableName = "user-connection-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";
const usersTableName = "users-table-offline";

let getRDSDBClientQueryMock: jest.Mock<any, any, any>;

jest.mock("@/config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
        EMOTE_REACTION_TABLE: "emote-reaction-table-offline",
        USERS_TABLE: "users-table-offline",
    },
    dbConfig: {
        DB_HOST: "",
        DB_USER: "",
        DB_PASSWORD: "",
        DB_NAME: "",
    },
}));
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

const testSetUp = (setUpDB: {
    isUserConnectionDBSetup: boolean;
    isUserDBSetup: boolean;
    isEmoteReactionDBSetup: boolean;
    isUserConnectionDBReturnUndefined?: boolean;
}): void => {
    const userConnectionDdbMock = ddbMock.on(GetCommand, {
        TableName: userConnectionTableName,
        Key: {
            connectionId: "connectionId",
        },
    });
    const userADdbMock = ddbMock.on(GetCommand, {
        TableName: usersTableName,
        Key: {
            userId: "@a",
        },
    });
    const userBDdbMock = ddbMock.on(GetCommand, {
        TableName: usersTableName,
        Key: {
            userId: "@b",
        },
    });
    const emoteReactionADdbMock = ddbMock.on(GetCommand, {
        TableName: emoteReactionTableName,
        Key: {
            emoteReactionId: "emoteReactionId-a",
        },
    });
    const emoteReactionBDdbMock = ddbMock.on(GetCommand, {
        TableName: emoteReactionTableName,
        Key: {
            emoteReactionId: "emoteReactionId-b",
        },
    });

    if (setUpDB.isUserConnectionDBSetup) {
        if (setUpDB.isUserConnectionDBReturnUndefined) {
            userConnectionDdbMock.resolves({
                Item: undefined,
            });
        } else {
            userConnectionDdbMock.resolves(userConnectionTableItem);
        }
    } else {
        userConnectionDdbMock.rejects(new Error());
    }

    if (setUpDB.isUserDBSetup) {
        userADdbMock.resolves(usersTableItemForA);
        userBDdbMock.resolves(usersTableItemForB);
    } else {
        userADdbMock.rejects(new Error());
        userBDdbMock.rejects(new Error());
    }

    if (setUpDB.isEmoteReactionDBSetup) {
        emoteReactionADdbMock.resolves(emoteReactionTableItemForUserA);
        emoteReactionBDdbMock.resolves(emoteReactionTableItemForUserB);
    } else {
        emoteReactionADdbMock.rejects(new Error());
        emoteReactionBDdbMock.rejects(new Error());
    }
};

beforeEach(() => {
    ddbMock.reset();
    getRDSDBClientQueryMock = jest.fn().mockResolvedValue(emoteTableItem);
});

describe("接続時", () => {
    test("正常時、sequenceNumber, emoteId, userName, userId, emoteDatetime, emoteReactionId, emoteEmojis, userAvatarUrl, emoteReactionEmojisから成る配列を返す", async () => {
        // Arrange
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        // Act
        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        // Assert
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            emotes: [
                new Emote(
                    1,
                    "emoteId-b",
                    "B",
                    "@b",
                    "2025-01-19 09:00:48",
                    "emoteReactionId-b",
                    [
                        { emojiId: ":bear:" },
                        { emojiId: ":bear:" },
                        { emojiId: ":sad:" },
                        { emojiId: ":party_parrot:" },
                    ],
                    "https://b.png",
                    [
                        {
                            emojiId: ":party_parrot:",
                            numberOfReactions: 100,
                        },
                    ],
                ),
                new Emote(
                    0,
                    "emoteId-a",
                    "A",
                    "@a",
                    "2025-01-18 09:00:48",
                    "emoteReactionId-a",
                    [
                        { emojiId: ":snake:" },
                        { emojiId: ":smile:" },
                        { emojiId: ":smile:" },
                        { emojiId: ":party_parrot:" },
                    ],
                    "https://a.png",
                    [
                        {
                            emojiId: ":snake:",
                            numberOfReactions: 23,
                        },
                        {
                            emojiId: ":smile",
                            numberOfReactions: 1,
                        },
                    ],
                ),
            ],
            connectionId: "connectionId",
        });
    });

    test("正常時、mySQLのDBに対してqueryが実行されている", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
            "SELECT * FROM wordlessdb.emote_table WHERE is_deleted = 0 ORDER BY emote_datetime DESC LIMIT 10",
        );
        expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
    });
});

describe("異常系", () => {
    test("リクエストのrequestContextが空の時、ステータスコード400とEMT-11を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: undefined,
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-11",
        });
    });

    test("リクエストのconnectionIdが空文字の時、ステータスコード400とEMT-11を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-11",
        });
    });

    test("リクエストのbodyが空の時、ステータスコード400とEMT-12を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-12",
        });
    });

    test("リクエストのactionが無い時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("リクエストのactionが空文字の時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10 }`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("リクエストのuserIdが無い時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("リクエストのuserIdが空文字の時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("リクエストのnumberOfCompletedAcquisitionsCompletedが0の時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 0}`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("リクエストのnumberOfCompletedAcquisitionsCompletedが無い時、ステータスコード400とEMT-13を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a" }`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-13",
        });
    });

    test("UserConnectionTableから空が返却された時、ステータスコード400とEMT-14を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
            isUserConnectionDBReturnUndefined: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-14",
        });
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とEMT-15を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: false,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-15",
        });
    });

    test("EmoteTableと接続できないとき、ステータスコード500とEMT-16を返す", async () => {
        getRDSDBClientQueryMock = jest.fn().mockRejectedValue(new Error());
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-16",
        });
    });

    test("UserTableと接続できないとき、ステータスコード500とEMT-17を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: false,
            isEmoteReactionDBSetup: true,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-17",
        });
    });

    test("EmoteReactionTableと接続できないとき、ステータスコード500とEMT-18を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: false,
        });

        const response = await fetchEmotes({
            requestContext: {
                connectionId: "connectionId",
            },
            body: `{ "action": "fetchEmotes", "userId": "@a", "numberOfCompletedAcquisitionsCompleted": 10}`,
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-18",
        });
    });
});
