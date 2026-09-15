// Runs once per `node --test` invocation (--test-global-setup).
// 1. refuse anything that is not a *_test database
// 2. create the test database if it does not exist yet
// 3. apply migrations with the project's own runner (runner.js)
// 4. verify every migration file is recorded, since runner.js swallows errors

import { Client } from 'pg';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { testDbConfig } from '../helpers/db.js';

async function ensureDatabase(config) {
    if (!/^[a-z0-9_]+$/i.test(config.database)) {
        throw new Error(`Unsafe database name: ${config.database}`);
    }
    const admin = new Client({ ...config, database: 'postgres' });
    await admin.connect();
    try {
        const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
        if (rowCount === 0) {
            await admin.query(`CREATE DATABASE "${config.database}"`);
            console.log(`[test-setup] created database ${config.database}`);
        }
    } finally {
        await admin.end();
    }
}

async function verifyMigrations(config) {
    const expected = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
    const client = new Client(config);
    await client.connect();
    try {
        const { rows } = await client.query('SELECT filename FROM schema_migration ORDER BY filename');
        const applied = rows.map((r) => r.filename);
        const missing = expected.filter((f) => !applied.includes(f));
        if (missing.length > 0) {
            throw new Error(`[test-setup] migrations not applied: ${missing.join(', ')}`);
        }
        console.log(`[test-setup] ${applied.length} migrations applied on ${config.database}`);
    } finally {
        await client.end();
    }
}

export async function globalSetup() {
    const config = testDbConfig();
    await ensureDatabase(config);
    // runner.js reads POSTGRES_* from process.env; the test process already
    // carries .env.test, so the child inherits it.
    execFileSync(process.execPath, ['runner.js'], { stdio: 'ignore', env: process.env });
    await verifyMigrations(config);
}

export async function globalTeardown() {
    // Nothing to tear down: the test database persists between runs and is
    // truncated per test. Drop it by hand if you ever want a clean slate.
}
