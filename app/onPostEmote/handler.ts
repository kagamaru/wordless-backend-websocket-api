import dayjs from "dayjs";
import { Guid } from "guid-typescript";
import { jwtDecode, JwtPayload } from "jwt-decode";
import {
    APIRequest,
    APIResponse,
    EmojiString,
    FetchedEmote,
    ScannedUserConnection,
    User,
    UserSub,
} from "@/@types";
import { envConfig } from "@/config";
import { Emote } from "@/classes/Emote";
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

    try {
        await verifyUserConnection({
            connectionId,
            sub: userSub,
            errorCode: ["WSK-42", "WSK-43"],
        });
    } catch (error) {
        return JSON.parse(error.message);
    }

    let userSubInfo: UserSub;
    try {
        userSubInfo = (await getItemFromDynamoDB(
            envConfig.USER_SUB_TABLE,
            {
                userSub,
            },
            "WSK-44",
            "WSK-45",
        )) as UserSub;

        if (userSubInfo.userSub !== userSub) {
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
        return createErrorResponse(500, "WSK-47");
    } finally {
        await mysqlClient.end();
    }

    try {
        userProfileInfo = (await getItemFromDynamoDB(
            envConfig.USERS_TABLE,
            {
                userId: userSubInfo.userId,
            },
            "WSK-48",
            "WSK-49",
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
            "WSK-50",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    let connections: Array<ScannedUserConnection>;
    try {
        connections = (await scanItemsFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            "WSK-51",
            "WSK-52",
        )) as Array<ScannedUserConnection>;
    } catch (error) {
        return JSON.parse(error.message);
    }

    const emote = new Emote(
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
    );

    try {
        await broadcastToAllConnections<{
            action: "onPostEmote";
            emote: Emote;
        }>(
            connections,
            {
                action: "onPostEmote",
                emote,
            },
            "WSK-53",
            "WSK-54",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
    };
};
