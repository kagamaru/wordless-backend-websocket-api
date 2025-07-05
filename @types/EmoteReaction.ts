import { EmojiString } from "@/@types";

export type EmoteReaction = {
    emoteReactionId: string;
    emoteReactionEmojis: Array<{
        emojiId: EmojiString;
        numberOfReactions: number;
    }>;
};
