export type APIResponse<T> = {
    statusCode: 200 | 400 | 500;
    body?:
        | T
        | {
              error: `${Uppercase<string>}${Uppercase<string>}${Uppercase<string>}-${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
          };
};
