import { mockClient } from "aws-sdk-client-mock";
import { Guid } from "guid-typescript";
import { connect } from "@/app/onconnect/handler";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { Emote } from "@/classes/Emote";

const ddbMock = mockClient(DynamoDBDocumentClient);

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
}): void => {
    const userConnectionDdbMock = ddbMock.on(PutCommand, {
        TableName: userConnectionTableName,
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
        userConnectionDdbMock.resolves({});
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

    jest.spyOn(Guid, "create").mockReturnValue(
        Guid.parse("00000000-0000-0000-0000-000000000000"),
    );
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
        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
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
            connectionId: "00000000-0000-0000-0000-000000000000",
        });
    });

    test("正常時、mySQLのDBに対してqueryが実行されている", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(getRDSDBClientQueryMock).toHaveBeenCalledWith(
            "SELECT * FROM wordlessdb.emote_table WHERE is_deleted = 0 ORDER BY emote_datetime DESC LIMIT 10",
        );
        expect(getRDSDBClientQueryMock).toHaveBeenCalledTimes(1);
    });
});

describe("異常系", () => {
    test("リクエストのbodyが空の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: undefined,
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのuserIdが空の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: undefined,
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのuserIdが空文字の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのnumberOfCompletedAcquisitionsCompletedが0の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 0,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("リクエストのnumberOfCompletedAcquisitionsCompletedが空の時、ステータスコード400とEMT-01を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: undefined,
            },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "EMT-01",
        });
    });

    test("UserConnectionTableと接続できないとき、ステータスコード500とEMT-02を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: false,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-02",
        });
    });

    test("EmoteTableと接続できないとき、ステータスコード500とEMT-03を返す", async () => {
        getRDSDBClientQueryMock = jest.fn().mockRejectedValue(new Error());
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-03",
        });
    });

    test("UserTableと接続できないとき、ステータスコード500とEMT-04を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: false,
            isEmoteReactionDBSetup: true,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-04",
        });
    });

    test("EmoteReactionTableと接続できないとき、ステータスコード500とEMT-05を返す", async () => {
        testSetUp({
            isUserConnectionDBSetup: true,
            isUserDBSetup: true,
            isEmoteReactionDBSetup: false,
        });

        const response = await connect({
            body: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "EMT-05",
        });
    });
});
