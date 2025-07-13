import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Uint8ArrayBlobAdapter } from "@aws-sdk/util-stream";
import dayjs from "dayjs";
import {
    APIRequest,
    APIResponse,
    EmojiString,
    ScannedUserConnection,
} from "@/@types";
import { envConfig } from "@/config";
import { Emote } from "@/classes/Emote";
import {
    broadcastToAllConnections,
    createErrorResponse,
    isInvalidRequest,
    scanItemsFromDynamoDB,
    verifyToken,
    verifyUserConnection,
} from "@/utility";
import { emojiIds } from "@/static/emojiIds";

dayjs.locale("ja");

type PostEmoteRequestBody = {
    action: "onPostEmote";
    userId: string;
    emoteEmoji1: EmojiString;
    emoteEmoji2: EmojiString | undefined;
    emoteEmoji3: EmojiString | undefined;
    emoteEmoji4: EmojiString | undefined;
    Authorization: string;
};

export const onPostEmoteEntry = async (
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
        Authorization,
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

    const result = await verifyToken(Authorization);
    if (result.statusCode !== 200) {
        return result;
    }

    const {
        requestContext: { connectionId },
    } = event;

    try {
        await verifyUserConnection({
            connectionId,
            sub: result.body.sub,
            errorCode: ["WSK-42", "WSK-43"],
        });
    } catch (error) {
        return JSON.parse(error.message);
    }

    const lambdaClient = new LambdaClient({
        region: "us-west-2",
    });
    const invokeCommand = new InvokeCommand({
        FunctionName: envConfig.POST_EMOTE_CORE_LAMBDA_NAME,
        InvocationType: "RequestResponse",
        Payload: JSON.stringify({
            userId,
            emoteEmoji1,
            emoteEmoji2,
            emoteEmoji3,
            emoteEmoji4,
        }),
    });

    let postEmoteCoreResponse: Emote | APIResponse<undefined>;
    let payload: Uint8ArrayBlobAdapter;
    try {
        const payload = (await lambdaClient.send(invokeCommand)).Payload;
        postEmoteCoreResponse = JSON.parse(payload.transformToString()).body
            .emote as Emote;
    } catch {
        const errorContent = JSON.parse(payload.transformToString()).body.error;
        const statusCode = JSON.parse(payload.transformToString()).statusCode;
        return createErrorResponse(statusCode, errorContent);
    }

    let connections: Array<ScannedUserConnection>;
    try {
        connections = (await scanItemsFromDynamoDB(
            envConfig.USER_CONNECTION_TABLE,
            "WSK-44",
            "WSK-45",
        )) as Array<ScannedUserConnection>;
    } catch (error) {
        return JSON.parse(error.message);
    }

    try {
        await broadcastToAllConnections<{
            action: "onPostEmote";
            emote: Emote;
        }>(
            connections,
            {
                action: "onPostEmote",
                emote: postEmoteCoreResponse,
            },
            "WSK-46",
            "WSK-47",
        );
    } catch (error) {
        return JSON.parse(error.message);
    }

    return {
        statusCode: 200,
    };
};
