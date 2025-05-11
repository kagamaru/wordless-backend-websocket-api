import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { envConfig } from "@/config";
import { APIResponse } from "@/@types";
import { getDynamoDBClient, getSigningKeys } from "@/utility";
import { jwtDecode } from "jwt-decode";

const docClient = getDynamoDBClient();

type ReactRequest = {
    requestContext: {
        connectionId: string;
    };
    headers: {
        Authorization: string;
    };
    body: {
        action: "onreact";
        emoteReactionId: string;
        reactedEmojiId: `:${string}:`;
        reactedUserId: string;
        operation: "increment" | "decrement";
    };
};

export const onReact = async (
    event: ReactRequest,
): Promise<APIResponse<undefined>> => {
    if (
        !event?.requestContext ||
        !event.requestContext?.connectionId ||
        event.requestContext.connectionId.trim() === "" ||
        !event.headers?.Authorization ||
        !event.body?.action ||
        !event.body?.emoteReactionId ||
        !event.body?.reactedEmojiId ||
        !event.body?.reactedUserId ||
        !event.body?.operation
    ) {
        console.error("WSK-21");
        return {
            statusCode: 400,
            body: {
                error: "WSK-21",
            },
        };
    }

    const token = event.headers?.Authorization?.split("Bearer ")[1];
    if (!token) {
        console.error("WSK-22");
        return {
            statusCode: 401,
            body: {
                error: "WSK-22",
            },
        };
    }

    let keys: { [key: string]: any };
    try {
        keys = await getSigningKeys();
    } catch {
        console.error("WSK-23");
        return {
            statusCode: 500,
            body: {
                error: "WSK-23",
            },
        };
    }

    let decodedHeader: { alg: string; typ: string; kid: string };
    try {
        decodedHeader = await jwtDecode(token, { header: true });
    } catch {
        console.error("WSK-24");
        return {
            statusCode: 401,
            body: {
                error: "WSK-24",
            },
        };
    }

    const key = keys[decodedHeader.kid];
    if (!key) {
        console.error("WSK-25");
        return {
            statusCode: 401,
            body: {
                error: "WSK-25",
            },
        };
    }

    const {
        requestContext: { connectionId },
    } = event;

    try {
        const { Item } = await docClient.send(
            new GetCommand({
                TableName: envConfig.USER_CONNECTION_TABLE,
                Key: {
                    connectionId,
                },
            }),
        );

        if (!Item) {
            console.error("WSK-26");
            return {
                statusCode: 404,
                body: {
                    error: "WSK-26",
                },
            };
        }
    } catch (error) {
        console.error("WSK-27");
        return {
            statusCode: 500,
            body: {
                error: "WSK-27",
            },
        };
    }

    const { emoteReactionId, operation, reactedEmojiId, reactedUserId } =
        event.body;
    let emoteReaction: Record<"emoteReactionId", string> &
        Record<
            "emoteReactionEmojis",
            Array<{
                emojiId: `:${string}:`;
                numberOfReactions: number;
                reactedUserIds: string[];
            }>
        >;
    try {
        emoteReaction = (
            await docClient.send(
                new GetCommand({
                    TableName: envConfig.EMOTE_REACTION_TABLE,
                    Key: {
                        emoteReactionId,
                    },
                }),
            )
        ).Item as unknown as Record<"emoteReactionId", string> &
            Record<
                "emoteReactionEmojis",
                Array<{
                    emojiId: `:${string}:`;
                    numberOfReactions: number;
                    reactedUserIds: string[];
                }>
            >;
        if (!emoteReaction) {
            console.error("WSK-28");
            return {
                statusCode: 404,
                body: {
                    error: "WSK-28",
                },
            };
        }
    } catch (error) {
        console.error("WSK-29");
        return {
            statusCode: 500,
            body: {
                error: "WSK-29",
            },
        };
    }

    const emoteReactionEmojis = emoteReaction.emoteReactionEmojis;
    let isReactionAlreadyExistsError = false;
    if (operation === "increment") {
        // NOTE: 既にリアクションとして、配列の中に存在していた場合の処理
        // NOTE: リアクション件数が０件の場合もありうる
        emoteReactionEmojis.map((emoji) => {
            if (
                emoji.emojiId === reactedEmojiId &&
                !emoji.reactedUserIds.includes(reactedUserId)
            ) {
                emoji.numberOfReactions += 1;
                emoji.reactedUserIds.push(reactedUserId);
            } else if (
                emoji.emojiId === reactedEmojiId &&
                emoji.reactedUserIds.includes(reactedUserId)
            ) {
                isReactionAlreadyExistsError = true;
            }
        });

        if (isReactionAlreadyExistsError) {
            console.error("WSK-30");
            return {
                statusCode: 400,
                body: {
                    error: "WSK-30",
                },
            };
        }
        // NOTE: 既にリアクションとして、配列の中に存在していなかった場合の処理
        if (
            emoteReactionEmojis.every(
                (emoji) => emoji.emojiId !== reactedEmojiId,
            )
        ) {
            emoteReactionEmojis.push({
                emojiId: reactedEmojiId,
                numberOfReactions: 1,
                reactedUserIds: [reactedUserId],
            });
        }
    } else if (operation === "decrement") {
        const emoji = emoteReactionEmojis.find(
            (emoji) => emoji.emojiId === reactedEmojiId,
        );
        if (emoji.numberOfReactions === 0) {
            console.error("WSK-31");
            return {
                statusCode: 400,
                body: {
                    error: "WSK-31",
                },
            };
        }
        if (!emoji.reactedUserIds.includes(reactedUserId)) {
            console.error("WSK-32");
            return {
                statusCode: 400,
                body: {
                    error: "WSK-32",
                },
            };
        }

        emoteReactionEmojis.map((emoji) => {
            if (emoji.emojiId === reactedEmojiId) {
                emoji.numberOfReactions -= 1;
                emoji.reactedUserIds = emoji.reactedUserIds.filter(
                    (userId) => userId !== reactedUserId,
                );
            }
        });
    }

    try {
        await docClient.send(
            new PutCommand({
                TableName: envConfig.EMOTE_REACTION_TABLE,
                Item: {
                    ...emoteReaction,
                    emoteReactionEmojis: emoteReactionEmojis,
                },
            }),
        );
    } catch (error) {
        console.error("WSK-33");
        return {
            statusCode: 500,
            body: {
                error: "WSK-33",
            },
        };
    }

    return {
        statusCode: 200,
    };
};
