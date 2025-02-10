export type FetchedEmote = {
    sequence_number: number;
    emote_id: string;
    emote_reaction_id: string;
    user_id: string;
    emote_datetime: string;
    emote_emoji1: `:${string}:`;
    emote_emoji2: `:${string}:`;
    emote_emoji3: `:${string}:`;
    emote_emoji4: `:${string}:`;
    is_deleted: 0 | 1;
};
