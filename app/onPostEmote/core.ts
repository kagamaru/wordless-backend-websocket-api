import dayjs from "dayjs";
import { Guid } from "guid-typescript";
import {
    APIResponse,
    FetchedEmote,
    PostEmoteCorePayload,
    User,
} from "@/@types";
import { Emote } from "@/classes/Emote";
import { envConfig } from "@/config";
import {
    createErrorResponse,
    getItemFromDynamoDB,
    getRDSDBClient,
    putToDynamoDB,
} from "@/utility";

dayjs.locale("ja");
const mysqlClient = getRDSDBClient();

export const onPostEmoteCore = async (
    payload: PostEmoteCorePayload,
): Promise<APIResponse<{ emote: Emote } | undefined>> => {
    const { userId, emoteEmoji1, emoteEmoji2, emoteEmoji3, emoteEmoji4 } =
        payload;

    const emoteId = Guid.create().toString();
    const emoteReactionId = Guid.create().toString();
    const emoteDatetime = dayjs().format("YYYY-MM-DD HH:mm:ss");
    let fetchedEmote: FetchedEmote;
    let userProfileInfo: User;

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
        fetchedEmote = (
            await mysqlClient.query(
                `SELECT sequence_number, emote_id, emote_reaction_id, user_id, emote_datetime, emote_emoji1, emote_emoji2, emote_emoji3, emote_emoji4 FROM wordlessdb.emote_table WHERE emote_id = ? AND is_deleted = 0`,
                [emoteId],
            )
        )[0];
    } catch (error) {
        return createErrorResponse(500, "WSK-51");
    } finally {
        await mysqlClient.end();
    }

    try {
        userProfileInfo = (await getItemFromDynamoDB(
            envConfig.USERS_TABLE,
            {
                userId,
            },
            "WSK-52",
            "WSK-53",
        )) as User;
    } catch (error) {
        return JSON.parse(error.message);
    }

    try {
        await putToDynamoDB(
            envConfig.EMOTE_REACTION_TABLE,
            {
                emoteReactionId,
                emoteReactionEmojis: [],
            },
            "WSK-54",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
        body: {
            emote: new Emote(
                fetchedEmote.sequence_number,
                emoteId,
                userProfileInfo.userName,
                userProfileInfo.userId,
                fetchedEmote.emote_datetime,
                emoteReactionId,
                [
                    {
                        emojiId: emoteEmoji1,
                    },
                    {
                        emojiId: emoteEmoji2,
                    },
                    {
                        emojiId: emoteEmoji3,
                    },
                    {
                        emojiId: emoteEmoji4,
                    },
                ],
                userProfileInfo.userAvatarUrl,
                [],
                0,
            ),
        },
    };
};
