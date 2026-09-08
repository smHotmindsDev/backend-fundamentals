import {Client} from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
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

const migration_dir = './migrations';
function readFolder(dir) {
    try {
        const allFiles = fs.readdirSync(dir);
        const sqlFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.sql');
        console.log(`Loading ${dir}`);
        console.log(sqlFiles);

        return sqlFiles;
    } catch (error) {
        console.log(`Error: ${error}`);

        return [];
    }
}

async function migration(client, filename) {
    const fullFilePath = `${migration_dir}/${filename}`;
    console.log(`Executing: ${filename}...`);
    const sqlQuery = fs.readFileSync(fullFilePath, 'utf-8');
    console.log(sqlQuery);
    await client.query(sqlQuery);
}

async function logMigration(client, filename) {
    const sql = `INSERT INTO schema_migration (filename) VALUES ($1);`;
    await client.query(sql, [filename]);
    console.log(` Saved to schema_migration: ${filename}`);
}

// TODO: filters the array down to files that are missing from `schema_migration`
// TODO: runs the not-yet-applied files, one after another, in order
// TODO: updates `schema_migration`

// TEMP testing running scripts
async function runMigration() {
    try {
        await client.connect(); // Must manually open connection
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migration (
                filename TEXT PRIMARY KEY,
                migration_date TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

        const res = await client.query('SELECT * FROM schema_migration LIMIT 20');
        const sqlFiles = readFolder(migration_dir);
        const implementedSqlFiles = res.rows.map((row) => row.filename);
        const missingSqlFiles = sqlFiles.filter(file => !implementedSqlFiles.includes(file));

        if (missingSqlFiles.length > 0) {
            console.log('Migration rows:', missingSqlFiles);
            for (const filename of missingSqlFiles) {
                await migration(client, filename);
                await logMigration(client, filename);
                console.log(`✅ Success: ${filename}`);
            }
        } else {
            console.log(`❎No files found to be implemented`);
        }
    } catch (err) {
        console.error('Connection error:', err.stack);
    } finally {
        await client.end(); // Must manually close connection
    }
}



runMigration();