export type EmoteReaction = {
    emoteReactionId: string;
    emoteReactionEmojis: Array<{
        emojiId: `:${string}:`;
        numberOfReactions: number;
    }>;
};
