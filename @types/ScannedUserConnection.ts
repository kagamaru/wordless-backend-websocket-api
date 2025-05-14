export type ScannedUserConnection = {
    connectionId: {
        // NOTE: ScannedItemの型はDynamoDBの型に合わせる
        S: string;
    };
    timestamp: {
        S: string;
    };
    sub: {
        S: string;
    };
};
