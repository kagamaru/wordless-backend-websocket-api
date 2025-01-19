import { ServerlessMysql } from "serverless-mysql";

export const getRDSDBClient = (): ServerlessMysql => {
    const mysqlClient = require("serverless-mysql")({
        config: {
            host: process.env.ENDPOINT,
            database: process.env.DATABASE,
            user: process.env.USERNAME,
            password: process.env.PASSWORD,
        },
    });

    return mysqlClient;
};
