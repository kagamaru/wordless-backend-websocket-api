import dayjs from "dayjs";
import { Guid } from "guid-typescript";
import { jwtDecode, JwtPayload } from "jwt-decode";
import {
    APIRequest,
    APIResponse,
    EmojiString,
    ScannedUserConnection,
} from "@/@types";
import { envConfig } from "@/config";
import {
    broadcastToAllConnections,
    createErrorResponse,
    getItemFromDynamoDB,
    getRDSDBClient,
    isInvalidRequest,
    putToDynamoDB,
    scanItemsFromDynamoDB,
    verifyUserConnection,
} from "@/utility";
import { emojiIds } from "@/static/emojiIds";

dayjs.locale("ja");
const mysqlClient = getRDSDBClient();

type PostEmoteRequestBody = {
    action: "onPostEmote";
    userId: string;
    emoteEmoji1: EmojiString;
    emoteEmoji2: EmojiString | undefined;
    emoteEmoji3: EmojiString | undefined;
    emoteEmoji4: EmojiString | undefined;
    Authorization: string;
};

export const onPostEmote = async (
    event: APIRequest,
): Promise<APIResponse<undefined>> => {
    if (
        isInvalidRequest(event, [
            "action",
            "userId",
            "emoteEmoji1",
            "Authorization",
        ])
    ) {
        return createErrorResponse(400, "WSK-41");
    }

    const eventBody: PostEmoteRequestBody = JSON.parse(event.body);
    const {
        userId,
        emoteEmoji1,
        emoteEmoji2,
        emoteEmoji3,
        emoteEmoji4,
        Authorization: token,
    } = eventBody;

    let isEmoteEnd = false;
    for (const emoteEmoji of [
        emoteEmoji1,
        emoteEmoji2,
        emoteEmoji3,
        emoteEmoji4,
    ]) {
        if (!emoteEmoji) {
            isEmoteEnd = true;
        } else {
            // NOTE: undefinedの絵文字がある(既に投稿が終わっている)にも関わらず、後続の絵文字が存在する場合、エラーとする
            if (isEmoteEnd) {
                return createErrorResponse(400, "WSK-41");
            }
            // NOTE: 絵文字がリストの中に存在しない場合、エラーとする
            if (!emojiIds.includes(emoteEmoji)) {
                return createErrorResponse(400, "WSK-41");
            }
        }
    }

    // TODO: VPC内に存在するlambdaからRDSにアクセスするとコスト増であるため、現時点ではトークンの検証は行わない

    let decodedPayload: JwtPayload;
    try {
        decodedPayload = jwtDecode(token);
    } catch {
        return createErrorResponse(401, "AUN-02");
    }

    const {
        requestContext: { connectionId },
    } = event;
    const userSub = decodedPayload.sub;

    let sub: string;
    try {
        sub = await verifyUserConnection({
            connectionId,
            sub: userSub,
            errorCode: ["WSK-42", "WSK-43"],
        });
    } catch (error) {
        return JSON.parse(error.message);
    }

    try {
        const userInfo = await getItemFromDynamoDB(
            envConfig.USER_SUB_TABLE,
            {
                userSub,
            },
            "WSK-44",
            "WSK-45",
        );

        if (userInfo.userSub !== userSub) {
            throw new Error(
                JSON.stringify({
                    statusCode: 400,
                    body: {
                        error: "WSK-46",
                    },
                }),
            );
        }
    } catch (error) {
        return JSON.parse(error.message);
    }

    const emoteId = Guid.create().toString();
    const emoteReactionId = Guid.create().toString();
    const emoteDatetime = dayjs().format("YYYY-MM-DD HH:mm:ss");

    try {
        // NOTE: undefinedの値はmySqlClient側でNULLに変換される
        await mysqlClient.query(
            `INSERT INTO wordlessdb.emote_table (emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
                emoteId,
                emoteReactionId,
                userId,
                emoteDatetime,
                emoteEmoji1,
                emoteEmoji2,
                emoteEmoji3,
                emoteEmoji4,
            ],
        );
    } catch (error) {
        return createErrorResponse(500, "WSK-47");
    } finally {
        await mysqlClient.end();
    }

    try {
        await putToDynamoDB(
            envConfig.EMOTE_REACTION_TABLE,
            {
                emoteReactionId,
                emoteReactionEmojis: [],
            },
            "WSK-48",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    let connections: Array<ScannedUserConnection>;
    try {
        connections = (await scanItemsFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            "WSK-49",
            "WSK-50",
        )) as Array<ScannedUserConnection>;
    } catch (error) {
        return JSON.parse(error.message);
    }

    try {
        await broadcastToAllConnections<{
            action: "onPostEmote";
            emoteId: string;
            emoteEmoji1: EmojiString;
            emoteEmoji2: EmojiString | undefined;
            emoteEmoji3: EmojiString | undefined;
            emoteEmoji4: EmojiString | undefined;
            emoteReactionId: string;
            emoteReactionEmojis: [];
            totalNumberOfReactions: 0;
        }>(
            connections,
            {
                action: "onPostEmote",
                emoteId,
                emoteEmoji1,
                emoteEmoji2,
                emoteEmoji3,
                emoteEmoji4,
                emoteReactionId,
                emoteReactionEmojis: [],
                totalNumberOfReactions: 0,
            },
            "WSK-51",
            "WSK-52",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
    };
};
