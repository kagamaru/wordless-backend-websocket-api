import { EmojiIdObject } from "@/@types";

export type EmoteEmojis =
    | [EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject, EmojiIdObject];
