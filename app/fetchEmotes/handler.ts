import { GetCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { Emote } from "@/classes/Emote";
import { envConfig } from "@/config";
import { APIResponse, FetchedEmote } from "@/@types";
import { getDynamoDBClient, getRDSDBClient } from "@/utility";

const docClient = getDynamoDBClient();
const mysqlClient = getRDSDBClient();

dayjs.locale("ja");

type ConnectRequest = {
    body?: string;
};

type ConnectRequestBody = {
    action: "fetchEmotes";
    userId: string;
    numberOfCompletedAcquisitionsCompleted: number;
};

export const fetchEmotes = async (
    event: ConnectRequest,
): Promise<APIResponse<{ emotes: Emote[]; connectionId: string }>> => {
    if (!event.body) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-11",
            },
        };
    }

    const connectRequestBody: ConnectRequestBody = JSON.parse(event.body);

    if (
        !connectRequestBody.userId ||
        !connectRequestBody.numberOfCompletedAcquisitionsCompleted ||
        connectRequestBody.userId.trim() === ""
    ) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-12",
            },
        };
    }

    const { userId, numberOfCompletedAcquisitionsCompleted } =
        connectRequestBody;

    let userConnectionResponse: Record<
        "connectionId" | "userId" | "timestamp",
        string
    >;
    try {
        userConnectionResponse = (
            await docClient.send(
                new GetCommand({
                    TableName: envConfig.USER_CONNECTION_TABLE,
                    Key: {
                        userId,
                    },
                }),
            )
        ).Item;
        if (!userConnectionResponse) {
            return {
                statusCode: 400,
                body: {
                    error: "EMT-13",
                },
            };
        }
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-14",
            },
        };
    }

    let emotes = new Array<FetchedEmote>();
    try {
        emotes = await mysqlClient.query(
            `SELECT * FROM wordlessdb.emote_table WHERE is_deleted = 0 ORDER BY emote_datetime DESC LIMIT ${numberOfCompletedAcquisitionsCompleted}`,
        );
        await mysqlClient.end();
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-15",
            },
        };
    }

    const response = await Promise.all(
        emotes.map(async (emote) => {
            let userInfo: Record<
                "userId" | "userAvatarUrl" | "userName",
                string
            >;
            let emoteReaction: Record<"emoteReactionId", string> &
                Record<
                    "emoteReactionEmojis",
                    Array<{
                        emojiId: `:${string}:`;
                        numberOfReactions: number;
                    }>
                >;
            try {
                userInfo = (
                    await docClient.send(
                        new GetCommand({
                            TableName: envConfig.USERS_TABLE,
                            Key: {
                                userId: emote.user_id,
                            },
                        }),
                    )
                ).Item;
            } catch (error) {
                return "UserTableConnectionError";
            }

            try {
                // NOTE: ResponseがAny型になってしまうので、as で補正
                emoteReaction = (
                    await docClient.send(
                        new GetCommand({
                            TableName: envConfig.EMOTE_REACTION_TABLE,
                            Key: {
                                emoteReactionId: emote.emote_reaction_id,
                            },
                        }),
                    )
                ).Item as Record<"emoteReactionId", string> &
                    Record<
                        "emoteReactionEmojis",
                        Array<{
                            emojiId: `:${string}:`;
                            numberOfReactions: number;
                        }>
                    >;
            } catch (error) {
                return "EmoteReactionTableConnectionError";
            }

            return new Emote(
                emote.sequence_number,
                emote.emote_id,
                userInfo.userName,
                emote.user_id,
                emote.emote_datetime,
                emote.emote_reaction_id,
                [
                    { emojiId: emote.emote_emoji1 },
                    { emojiId: emote.emote_emoji2 },
                    { emojiId: emote.emote_emoji3 },
                    { emojiId: emote.emote_emoji4 },
                ],
                userInfo.userAvatarUrl,
                emoteReaction?.emoteReactionEmojis,
            );
        }),
    );

    if (response.includes("UserTableConnectionError")) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-16",
            },
        };
    } else if (response.includes("EmoteReactionTableConnectionError")) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-17",
            },
        };
    }

    return {
        statusCode: 200,
        // NOTE: 型エラーを防止する
        body: {
            emotes: response.filter(
                (element) =>
                    element !== "UserTableConnectionError" &&
                    element !== "EmoteReactionTableConnectionError",
            ),
            connectionId: userConnectionResponse?.connectionId,
        },
    };
};
