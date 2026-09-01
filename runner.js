import {Client} from "pg";
import validateEnv from "./utils/validateEnv.js";

const isValidEnv = validateEnv(process.env);
const env = isValidEnv.env ? isValidEnv.env : null;
console.log(env);

const client = new Client({
    user: env.POSTGRES_USER,
    host: 'localhost',
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
    port: 5432,
});
async function runMigration() {
    try {
        await client.connect(); // Must manually open connection

        const res = await client.query('SELECT NOW()');
        console.log('Current Time:', res.rows[0]);

    } catch (err) {
        console.error('Connection error:', err.stack);
    } finally {
        await client.end(); // Must manually close connection
    }
}

runMigration();