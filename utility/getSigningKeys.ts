import { FetchedJWKKeys, JWKKey } from "@/@types";
import { cognitoConfig } from "@/config";

const COGNITO_USER_POOL_ID = cognitoConfig.COGNITO_USER_POOL_ID;
const COGNITO_REGION = cognitoConfig.COGNITO_REGION;

if (!COGNITO_USER_POOL_ID || !COGNITO_REGION) {
    throw new Error(
        "環境変数 COGNITO_USER_POOL_ID または COGNITO_REGION が設定されていません。",
    );
}

const JWKS_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

let cachedKeys: { [key: string]: JWKKey } | undefined = undefined;

export const getSigningKeys = async () => {
    if (!cachedKeys) {
        const response = await fetch(JWKS_URL);
        const jwks = (await response.json()) as FetchedJWKKeys;
        cachedKeys = jwks.keys.reduce(
            (acc: { [key: string]: JWKKey }, key: JWKKey) => {
                acc[key.kid] = key;
                return acc;
            },
            {},
        );
    }
    return cachedKeys;
};
