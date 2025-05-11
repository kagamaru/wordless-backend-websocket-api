import { jest } from "@jest/globals";
import "aws-sdk-client-mock-jest";

jest.mock("@/config", () => ({
    envConfig: {
        USER_CONNECTION_TABLE: "user-connection-table-offline",
        EMOTE_REACTION_TABLE: "emote-reaction-table-offline",
    },
    cognitoConfig: {
        COGNITO_USER_POOL_ID: "mock-cognito-user-pool-id",
        COGNITO_REGION: "mock-cognito-region",
    },
}));

const mockSigningKeys = {
    "mock-kid-123": {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        n: "test-modulus-base64url",
        e: "AQAB",
    },
    "mock-kid-456": {
        kty: "RSA",
        alg: "RS256",
        use: "sig",
        n: "another-test-modulus",
        e: "AQAB",
    },
};
jest.mock("@/utility/getSigningKeys", () => ({
    getSigningKeys: jest.fn(async () => mockSigningKeys),
}));

jest.mock("jwt-decode", () => ({
    jwtDecode: jest.fn((_token: string, options?: { header?: boolean }) => {
        if (options?.header) {
            return {
                alg: "RS256",
                typ: "JWT",
                kid: "mock-kid-123",
            };
        } else {
            return {
                sub: "mock-sub",
            };
        }
    }),
}));
