export type Emote = {
    emoteId: string;
    emoteReactionId: string;
    userId: string;
    emoteDatetime: string;
    emoteEmojis: EmoteEmojis;
};

type EmoteEmojis =
    | [EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject, EmojiIdObject];

type EmojiIdObject = {
    emojiId: `:${string}:`;
};
