import { EmojiString } from "@/@types";

export type PostEmoteCorePayload = {
    userId: string;
    emoteEmoji1: EmojiString;
    emoteEmoji2: EmojiString | undefined;
    emoteEmoji3: EmojiString | undefined;
    emoteEmoji4: EmojiString | undefined;
};
