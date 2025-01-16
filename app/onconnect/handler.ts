import { AttributeValue, ScanCommand } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { Guid } from "guid-typescript";
import { getDynamoDBClient } from "@/utility/getDynamoDBClient";
import { onConnectResponse } from "@/classes/onConnectResponse";

const {
    USER_CONNECTION_TABLE,
    EMOTE_TABLE,
    EMOTE_REACTION_TABLE,
    USERS_TABLE,
} = process.env;

const docClient = getDynamoDBClient();

dayjs.locale("ja");

export const connect = async (event: any) => {
    const { userId } = event.data;
    if (!userId) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-05",
            },
        };
    }
    const connectionId = Guid.create();

    try {
        await docClient.send(
            new PutCommand({
                TableName: USER_CONNECTION_TABLE,
                Item: {
                    connectionId: connectionId.toString(),
                    userId,
                    timestamp: dayjs().toString(),
                },
            }),
        );
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "UCN-04",
            },
        };
    }

    let emotes: Record<string, AttributeValue>[] = [];
    try {
        emotes = (
            await docClient.send(
                new ScanCommand({
                    TableName: EMOTE_TABLE,
                }),
            )
        ).Items;
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-04",
            },
        };
    }

    const response = await Promise.all(
        emotes.map(async (emote) => {
            let userInfo: Record<string, any>;
            let emoteReaction: Record<string, any>;
            try {
                userInfo = (
                    await docClient.send(
                        new GetCommand({
                            TableName: USERS_TABLE,
                            Key: {
                                userId: emote.userId.S,
                            },
                        }),
                    )
                ).Item;
            } catch {
                return "User Table Connection Error";
            }

            try {
                emoteReaction = (
                    await docClient.send(
                        new GetCommand({
                            TableName: EMOTE_REACTION_TABLE,
                            Key: {
                                emoteReactionId: emote.emoteReactionId.S,
                            },
                        }),
                    )
                ).Item;
            } catch {
                return "Emote Reaction Table Connection Error";
            }

            return new onConnectResponse(
                emote.emoteId.S,
                userInfo.userName,
                emote.userId.S,
                emote.emoteDatetime.S,
                emote.emoteReactionId.S,
                emote.emoteEmojis.L.map((emoteEmoji) => {
                    return { emojiId: emoteEmoji.S };
                }),
                userInfo.userAvatarUrl,
                emoteReaction.emoteReactionEmojis,
                connectionId.toString(),
            );
        }),
    );

    if (response.includes("User Table Connection Error")) {
        return {
            statusCode: 500,
            body: {
                error: "USE-02",
            },
        };
    } else if (response.includes("Emote Reaction Table Connection Error")) {
        return {
            statusCode: 500,
            body: {
                error: "EMR-02",
            },
        };
    }

    return {
        statusCode: 200,
        body: {
            response,
        },
    };
};
