import { envConfig } from "@/config";
import {
    APIRequest,
    APIResponse,
    EmojiString,
    FetchedEmoteReaction,
    ScannedUserConnection,
} from "@/@types";
import {
    broadcastToAllConnections,
    createErrorResponse,
    getItemFromDynamoDB,
    isInvalidRequest,
    putToDynamoDB,
    scanItemsFromDynamoDB,
    verifyToken,
    verifyUserConnection,
} from "@/utility";
import { emojiIds } from "@/static/emojiIds";

type ReactRequestBody = {
    action: "onReact";
    emoteReactionId: string;
    reactedEmojiId: EmojiString;
    reactedUserId: string;
    operation: "increment" | "decrement";
    Authorization: string;
};

export const onReact = async (
    event: APIRequest,
): Promise<APIResponse<undefined>> => {
    if (
        isInvalidRequest(event, [
            "action",
            "emoteReactionId",
            "reactedEmojiId",
            "reactedUserId",
            "operation",
            "Authorization",
        ])
    ) {
        return createErrorResponse(400, "WSK-21");
    }

    const eventBody: ReactRequestBody = JSON.parse(event.body);
    if (!emojiIds.includes(eventBody.reactedEmojiId)) {
        return createErrorResponse(400, "WSK-21");
    }

    const result = await verifyToken(eventBody.Authorization);
    if (result.statusCode !== 200) {
        return result;
    }

    const {
        requestContext: { connectionId },
    } = event;
    const { emoteReactionId, operation, reactedEmojiId, reactedUserId } =
        eventBody;

    try {
        await verifyUserConnection({
            connectionId,
            sub: result.body.sub,
            errorCode: ["WSK-22", "WSK-23"],
        });
    } catch (error) {
        return JSON.parse(error.message);
    }

    let emoteReaction: FetchedEmoteReaction;
    try {
        emoteReaction = (await getItemFromDynamoDB(
            envConfig.EMOTE_REACTION_TABLE,
            {
                emoteReactionId,
            },
            "WSK-24",
            "WSK-25",
        )) as FetchedEmoteReaction;
    } catch (error) {
        return JSON.parse(error.message);
    }

    let emoteReactionEmojis = emoteReaction.emoteReactionEmojis;

    try {
        if (operation === "increment") {
            emoteReactionEmojis = incrementReaction(
                emoteReactionEmojis,
                reactedEmojiId,
                reactedUserId,
            ).emoteReactionEmojis;
        } else if (operation === "decrement") {
            emoteReactionEmojis = decrementReaction(
                emoteReactionEmojis,
                reactedEmojiId,
                reactedUserId,
            ).emoteReactionEmojis;
        }
    } catch (error) {
        return JSON.parse(error.message);
    }

    const totalNumberOfReactions = emoteReactionEmojis.reduce(
        (acc, emoji) => acc + (emoji.numberOfReactions || 0),
        0,
    );

    try {
        await putToDynamoDB(
            envConfig.EMOTE_REACTION_TABLE,
            {
                ...emoteReaction,
                emoteReactionEmojis: emoteReactionEmojis,
            },
            "WSK-30",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    let connections: Array<ScannedUserConnection>;
    try {
        connections = (await scanItemsFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            "WSK-31",
            "WSK-32",
        )) as Array<ScannedUserConnection>;
    } catch (error) {
        return JSON.parse(error.message);
    }

    try {
        await broadcastToAllConnections<{
            action: "onReact";
            emoteReactionId: string;
            emoteReactionEmojis: FetchedEmoteReaction["emoteReactionEmojis"];
            totalNumberOfReactions: number;
        }>(
            connections,
            {
                action: "onReact",
                emoteReactionId,
                emoteReactionEmojis,
                totalNumberOfReactions,
            },
            "WSK-33",
            "WSK-34",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
    };
};

function incrementReaction(
    emoteReactionEmojis: FetchedEmoteReaction["emoteReactionEmojis"],
    reactedEmojiId: EmojiString,
    reactedUserId: string,
): {
    emoteReactionEmojis: FetchedEmoteReaction["emoteReactionEmojis"];
} {
    const emoji = emoteReactionEmojis.find(
        (emoji) => emoji.emojiId === reactedEmojiId,
    );

    // NOTE: まだリアクションとして存在していない絵文字に対してincrementしている場合
    if (!emoji) {
        emoteReactionEmojis.push({
            emojiId: reactedEmojiId,
            numberOfReactions: 1,
            reactedUserIds: [reactedUserId],
        });
        return { emoteReactionEmojis };
    }

    // NOTE: 当該ユーザーが今までにリアクションしたことがある絵文字に対してincrementしている場合
    if (emoji.reactedUserIds.includes(reactedUserId)) {
        console.error("WSK-26");
        throw new Error(
            JSON.stringify({
                statusCode: 400,
                body: {
                    error: "WSK-26",
                },
            }),
        );
    }

    emoteReactionEmojis.forEach((emoji) => {
        if (emoji.emojiId === reactedEmojiId) {
            emoji.numberOfReactions += 1;
            emoji.reactedUserIds.push(reactedUserId);
        }
    });

    return { emoteReactionEmojis };
}

function decrementReaction(
    emoteReactionEmojis: FetchedEmoteReaction["emoteReactionEmojis"],
    reactedEmojiId: EmojiString,
    reactedUserId: string,
) {
    const emoji = emoteReactionEmojis.find(
        (emoji) => emoji.emojiId === reactedEmojiId,
    );

    // NOTE: まだリアクションとして存在していない絵文字に対してdecrementしている場合、エラーとする
    if (!emoji) {
        console.error("WSK-27");
        throw new Error(
            JSON.stringify({
                statusCode: 400,
                body: {
                    error: "WSK-27",
                },
            }),
        );
    }
    // NOTE: リアクション件数が0件の絵文字に対してdecrementしている場合、エラーとする
    if (emoji.numberOfReactions === 0) {
        console.error("WSK-28");
        throw new Error(
            JSON.stringify({
                statusCode: 400,
                body: {
                    error: "WSK-28",
                },
            }),
        );
    }
    // NOTE: 当該ユーザーが今までにリアクションしたことがない絵文字に対してdecrementしている場合、エラーとする
    if (!emoji.reactedUserIds.includes(reactedUserId)) {
        console.error("WSK-29");
        throw new Error(
            JSON.stringify({
                statusCode: 400,
                body: {
                    error: "WSK-29",
                },
            }),
        );
    }

    emoteReactionEmojis.forEach((emoji) => {
        if (emoji.emojiId === reactedEmojiId) {
            emoji.numberOfReactions -= 1;
            emoji.reactedUserIds = emoji.reactedUserIds.filter(
                (userId) => userId !== reactedUserId,
            );
        }
    });

    return { emoteReactionEmojis };
}
