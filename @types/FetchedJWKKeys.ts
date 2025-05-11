export type FetchedJWKKeys = {
    keys: JWKKey[];
};

export type JWKKey = {
    alg: string;
    e: string;
    kid: string;
    kty: string;
    n: string;
    use: string;
};
