import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { Guid } from "guid-typescript";
import { ConnectResponse } from "@/classes/ConnectResponse";
import { envConfig } from "@/config";
import { APIResponse, Emote } from "@/@types";
import { getDynamoDBClient, getRDSDBClient } from "@/utility";

const docClient = getDynamoDBClient();
const mysqlClient = getRDSDBClient();

dayjs.locale("ja");

type ConnectRequest = {
    body: {
        userId: string;
        numberOfCompletedAcquisitionsCompleted: number;
    };
};

export const connect = async (
    event: ConnectRequest,
): Promise<
    APIResponse<{ connectResponse: ConnectResponse[]; connectionId: string }>
> => {
    // NOTE: wscatはConnect時のリクエスト渡しをサポートしていないので、offlineでのテスト時はコメントを外す
    // const event = {
    //     body: {
    //         userId: "@fuga_fuga",
    //         numberOfCompletedAcquisitionsCompleted: 10,
    //     },
    // };
    const { userId, numberOfCompletedAcquisitionsCompleted } = event.body;
    if (!event.body || !userId || !numberOfCompletedAcquisitionsCompleted) {
        return {
            statusCode: 400,
            body: {
                error: "EMT-01",
            },
        };
    }
    const connectionId = Guid.create().toString();

    try {
        await docClient.send(
            new PutCommand({
                TableName: envConfig.USER_CONNECTION_TABLE,
                Item: {
                    connectionId,
                    userId,
                    timestamp: dayjs().toString(),
                },
            }),
        );
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-02",
            },
        };
    }

    let emotes = new Array<Emote>();
    try {
        emotes = await mysqlClient.query(
            `SELECT * FROM wordlessdb.emote_table WHERE is_deleted = 0 ORDER BY emote_datetime DESC LIMIT ${event.body.numberOfCompletedAcquisitionsCompleted}`,
        );
        await mysqlClient.end();
    } catch (error) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-03",
            },
        };
    }

    const connectResponse = await Promise.all(
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

            return new ConnectResponse(
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

    if (connectResponse.includes("UserTableConnectionError")) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-04",
            },
        };
    } else if (connectResponse.includes("EmoteReactionTableConnectionError")) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-05",
            },
        };
    }

    return {
        statusCode: 200,
        // NOTE: 型エラーを防止する
        body: {
            connectResponse: connectResponse.filter(
                (element) =>
                    element !== "UserTableConnectionError" &&
                    element !== "EmoteReactionTableConnectionError",
            ),
            connectionId,
        },
    };
};
