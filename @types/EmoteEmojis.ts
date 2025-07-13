import { EmojiIdObject } from "@/@types";

export type EmoteEmojis =
    | [EmojiIdObject, undefined, undefined, undefined]
    | [EmojiIdObject, EmojiIdObject, undefined, undefined]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject, undefined]
    | [EmojiIdObject, EmojiIdObject, EmojiIdObject, EmojiIdObject];
