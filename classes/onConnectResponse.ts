export class onConnectResponse {
    public emoteId: string;
    public userName: string;
    public userId: string;
    public emoteDatetime: string;
    public emoteReactionId: string;
    public emoteEmojis: Array<{ emojiId: string }>;
    public userAvatarUrl: string;
    public emoteReactionEmojis: Array<{
        emojiId: string;
        numberOfReactions: number;
    }>;
    public connectionId: string;

    constructor(
        emoteId: string,
        userName: string,
        userId: string,
        emoteDatetime: string,
        emoteReactionId: string,
        emoteEmojis: Array<{ emojiId: string }>,
        userAvatarUrl: string,
        emoteReactionEmojis: Array<EmoteReactionEmojiWithNumber>,
        connectionId: string,
    ) {
        this.emoteId = emoteId;
        this.userName = userName;
        this.userId = userId;
        this.emoteDatetime = emoteDatetime;
        this.emoteReactionId = emoteReactionId;
        this.emoteEmojis = emoteEmojis;
        this.userAvatarUrl = userAvatarUrl;
        this.emoteReactionEmojis = emoteReactionEmojis;
        this.connectionId = connectionId;
    }
}

type EmoteReactionEmojiWithNumber = {
    emojiId: string;
    numberOfReactions: number;
};
