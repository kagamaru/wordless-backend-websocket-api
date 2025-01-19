import { mockClient } from "aws-sdk-client-mock";
import { Guid } from "guid-typescript";
import { connect } from "@/app/onconnect/handler";
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { QueryCommand } from "@aws-sdk/client-dynamodb";

const ddbMock = mockClient(DynamoDBDocumentClient);

const emoteTableItem = {
    Items: [
        {
            emoteId: {
                S: "emoteId-b",
            },
            emoteReactionId: {
                S: "emoteReactionId-b",
            },
            userId: {
                S: "@b",
            },
            emoteDatetime: {
                N: "1737191740",
            },
            emoteEmojis: {
                L: [
                    {
                        M: {
                            emojiId: { S: ":bear:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":bear:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":sad:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":party_parrot:" },
                        },
                    },
                ],
            },
        },
        {
            emoteId: {
                S: "emoteId-a",
            },
            emoteReactionId: {
                S: "emoteReactionId-a",
            },
            userId: {
                S: "@a",
            },
            emoteDatetime: {
                N: "1737191746",
            },
            emoteEmojis: {
                L: [
                    {
                        M: {
                            emojiId: { S: ":snake:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":smile:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":smile:" },
                        },
                    },
                    {
                        M: {
                            emojiId: { S: ":party_parrot:" },
                        },
                    },
                ],
            },
        },
    ],
};

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
const emoteTableName = "emote-table-offline";
const emoteReactionTableName = "emote-reaction-table-offline";
const usersTableName = "users-table-offline";

jest.mock("@/env.config", () => ({
    // HACK: 変数へのアクセスが不可のため、ハードコーディングする
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
        EMOTE_TABLE: "emote-table-offline",
        EMOTE_REACTION_TABLE: "emote-reaction-table-offline",
        USERS_TABLE: "users-table-offline",
    },
}));

beforeEach(() => {
    ddbMock.reset();
});

describe("接続時", () => {
    test("正常時、emoteId, userName, userId, emoteDatetime, emoteReactionId, emoteEmojis, userAvatarUrl, emoteReactionEmojis, connectionIdから成る配列を返す", async () => {
        ddbMock
            .on(PutCommand, { TableName: userConnectionTableName })
            .resolves({});
        ddbMock
            .on(QueryCommand, { TableName: emoteTableName })
            .resolves(emoteTableItem);
        ddbMock
            .on(GetCommand, {
                TableName: usersTableName,
                Key: {
                    userId: "@a",
                },
            })
            .resolves(usersTableItemForA);
        ddbMock
            .on(GetCommand, {
                TableName: usersTableName,
                Key: {
                    userId: "@b",
                },
            })
            .resolves(usersTableItemForB);
        ddbMock
            .on(GetCommand, {
                TableName: emoteReactionTableName,
                Key: {
                    emoteReactionId: "emoteReactionId-a",
                },
            })
            .resolves(emoteReactionTableItemForUserA);
        ddbMock
            .on(GetCommand, {
                TableName: emoteReactionTableName,
                Key: {
                    emoteReactionId: "emoteReactionId-b",
                },
            })
            .resolves(emoteReactionTableItemForUserB);
        jest.spyOn(Guid, "create").mockReturnValue(
            Guid.parse("00000000-0000-0000-0000-000000000000"),
        );

        const response = await connect({
            data: {
                userId: "@a",
                numberOfCompletedAcquisitionsCompleted: 10,
            },
        });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            // displayEmotes: [
            //     new onConnectResponse({}),
            //     new onConnectResponse({}),
            // ],
        });
    });

    test.todo(
        "登録されているemoteが10件以上の時、10件のみ取り出し、順番を登録日時の降順とする",
    );
});
