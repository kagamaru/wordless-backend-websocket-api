// NOTE: 環境変数を別モジュールにまとめることで、再利用性とテスト性を向上させる

export const envConfig = {
    USER_CONNECTION_TABLE: process.env.USER_CONNECTION_TABLE,
    EMOTE_TABLE: process.env.EMOTE_TABLE,
    EMOTE_REACTION_TABLE: process.env.EMOTE_REACTION_TABLE,
    USERS_TABLE: process.env.USERS_TABLE,
};

export const dbConfig = {
    DB_HOST: process.env.DB_HOST,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
};

export const cognitoConfig = {
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_REGION: process.env.COGNITO_REGION,
};
