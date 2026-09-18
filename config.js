import { types } from 'pg';

// `date` columns come back as 'YYYY-MM-DD' strings. pg's default parses them
// into a JS Date in the local time zone — an off-by-one waiting to happen, and
// the contracts promise `format: date` (docs/api-contracts/create-loan.md).
// tests/helpers/db.js does the same for the test pool.
// setTypeParser is process-global: it affects every pg client in this process.
types.setTypeParser(types.builtins.DATE, (v) => v);

export function createConfig(env = process.env) {
    return {
        user: env.POSTGRES_USER,
        host: 'localhost',
        database: env.POSTGRES_DB,
        password: env.POSTGRES_PASSWORD,
        port: 5432,
    };
}
