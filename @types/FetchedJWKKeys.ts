export type FetchedJWKKeys = {
    keys: JWKKey[];
};

export type JWKAlg = "RS256" | "HS256";
export type JWKKey = {
    alg: JWKAlg;
    e: string;
    kid: string;
    kty: "RSA" | "oct";
    n: string;
    use: string;
};
