import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import dayjs from "dayjs";
import "dayjs/locale/ja";
import { Guid } from "guid-typescript";
import { onConnectResponse } from "@/classes/onConnectResponse";
import { envConfig } from "@/config";
import { getDynamoDBClient } from "@/utility/getDynamoDBClient";
import { getRDSDBClient } from "@/utility/getRDSDBClient";

const docClient = getDynamoDBClient();
const mysqlClient = getRDSDBClient();

dayjs.locale("ja");

type OnConnectRequest = {
    body: {
        userId: string;
        numberOfCompletedAcquisitionsCompleted: number;
    };
};

export const connect = async (
    event: OnConnectRequest,
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
    if (!userId || !numberOfCompletedAcquisitionsCompleted) {
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
                    timestamp: dayjs().unix(),
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

    let emotes: Record<string, AttributeValue>[] = [];
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
                                userId: emote.userId.S,
                            },
                        }),
                    )
                ).Item;
            } catch {
                return "UserTableConnectionError";
            }

            try {
                emoteReaction = (
                    await docClient.send(
                        new GetCommand({
                            TableName: envConfig.EMOTE_REACTION_TABLE,
                            Key: {
                                emoteReactionId: emote.emoteReactionId.S,
                            },
                        }),
                    )
                ).Item;
            } catch {
                return "EmoteReactionTableConnectionError";
            }

            return new onConnectResponse(
                emote.emoteId.S,
                userInfo.userName,
                emote.userId.S,
                emote.emoteDatetime.N,
                emote.emoteReactionId.S,
                emote.emoteEmojis.L.map((emoteEmoji) => {
                    return { emojiId: emoteEmoji.M.emojiId.S };
                }),
                userInfo.userAvatarUrl,
                emoteReaction?.emoteReactionEmojis,
            );
        }),
    );

    if (
        connectResponse.every(
            (element: onConnectResponse) =>
                element === "UserTableConnectionError" ||
                element === "EmoteReactionTableConnectionError",
        )
    ) {
        return {
            statusCode: 500,
            body: {
                error: "EMT-04",
            },
        };
    } else if (
        connectResponse.includes("Emote Reaction Table Connection Error")
    ) {
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
