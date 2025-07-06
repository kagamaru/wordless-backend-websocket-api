export class Emote {
    public sequenceNumber: number;
    public emoteId: string;
    public userName: string;
    public userId: string;
    public emoteDatetime: string;
    public emoteReactionId: string;
    public emoteEmojis: Array<{ emojiId: string | undefined }>;
    public userAvatarUrl: string;
    public emoteReactionEmojis: Array<{
        emojiId: string;
        numberOfReactions: number;
    }>;
    public totalNumberOfReactions: number;

    constructor(
        sequenceNumber: number,
        emoteId: string,
        userName: string,
        userId: string,
        emoteDatetime: string,
        emoteReactionId: string,
        emoteEmojis: Array<{ emojiId: string | undefined }>,
        userAvatarUrl: string,
        emoteReactionEmojis: Array<EmoteReactionEmojiWithNumber>,
        totalNumberOfReactions: number,
    ) {
        this.sequenceNumber = sequenceNumber;
        this.emoteId = emoteId;
        this.userName = userName;
        this.userId = userId;
        this.emoteDatetime = emoteDatetime;
        this.emoteReactionId = emoteReactionId;
        this.emoteEmojis = emoteEmojis;
        this.userAvatarUrl = userAvatarUrl;
        this.emoteReactionEmojis = emoteReactionEmojis;
        this.totalNumberOfReactions = totalNumberOfReactions;
    }
}

type EmoteReactionEmojiWithNumber = {
    emojiId: string;
    numberOfReactions: number;
};
