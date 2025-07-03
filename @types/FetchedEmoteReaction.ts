import { EmojiString } from "@/@types";

export type FetchedEmoteReaction = Record<"emoteReactionId", string> &
    Record<
        "emoteReactionEmojis",
        Array<{
            emojiId: EmojiString;
            numberOfReactions: number;
            reactedUserIds: string[] | undefined;
        }>
    >;
