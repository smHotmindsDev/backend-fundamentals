import {Client} from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import validateEnv from "./utils/validateEnv.js";

const isValidEnv = validateEnv(process.env);

if (!isValidEnv.success) {
    console.error('Invalid environment; refusing to migrate.');
    process.exit(1);
}

const env = isValidEnv.env;

const client = new Client({
    user: env.POSTGRES_USER,
    host: env.POSTGRES_HOST,
    database: env.POSTGRES_DB,
    password: env.POSTGRES_PASSWORD,
    port: env.POSTGRES_PORT,
});

const migration_dir = './migrations';
function readFolder(dir) {
    try {
        const allFiles = fs.readdirSync(dir);
        const sqlFiles = allFiles
            .filter(file => path.extname(file).toLowerCase() === '.sql')
            .sort();
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

        const res = await client.query('SELECT filename FROM schema_migration');
        const sqlFiles = readFolder(migration_dir);
        const implementedSqlFiles = new Set(res.rows.map((row) => row.filename));
        const missingSqlFiles = sqlFiles.filter(file => !implementedSqlFiles.has(file));

        if (missingSqlFiles.length > 0) {
            console.log('Migration rows:', missingSqlFiles);
            for (const filename of missingSqlFiles) {
                // DDL and its schema_migration row must land together, or a crash
                // between them leaves the migration applied but unrecorded.
                await client.query('BEGIN');
                try {
                    await migration(client, filename);
                    await logMigration(client, filename);
                    await client.query('COMMIT');
                } catch (err) {
                    await client.query('ROLLBACK');
                    throw err;
                }
                console.log(`✅ Success: ${filename}`);
            }
        } else {
            console.log(`❎No files found to be implemented`);
        }
    } catch (err) {
        // A failed migration must fail the process: callers (npm scripts,
        // tests/setup/global.js) rely on the exit code, not on stdout.
        console.error('Migration failed:', err.stack);
        process.exitCode = 1;
    } finally {
        await client.end(); // Must manually close connection
    }
}



runMigration();