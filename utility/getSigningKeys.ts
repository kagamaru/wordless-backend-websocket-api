const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_REGION = process.env.COGNITO_REGION!;
const JWKS_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

let cachedKeys: { [key: string]: any } | null = null;

export const getSigningKeys = async () => {
    if (!cachedKeys) {
        const response = await fetch(JWKS_URL);
        const keys = await response.json();
        cachedKeys = keys.reduce((acc: any, key: any) => {
            acc[key.kid] = key;
            return acc;
        }, {});
    }
    return cachedKeys;
};
