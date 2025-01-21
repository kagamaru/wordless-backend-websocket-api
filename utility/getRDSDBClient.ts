import { dbConfig } from "@/config";
import { ServerlessMysql } from "serverless-mysql";

export const getRDSDBClient = (): ServerlessMysql => {
    const mysqlClient = require("serverless-mysql")({
        config: {
            host: dbConfig.DB_HOST,
            database: dbConfig.DB_NAME,
            user: dbConfig.DB_USER,
            password: dbConfig.DB_PASSWORD,
        },
    });

    return mysqlClient;
};
