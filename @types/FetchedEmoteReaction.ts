export type FetchedEmoteReaction = Record<"emoteReactionId", string> &
    Record<
        "emoteReactionEmojis",
        Array<{
            emojiId: `:${string}:`;
            numberOfReactions: number;
            reactedUserIds: string[] | undefined;
        }>
    >;
