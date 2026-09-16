export function createConfig(env = process.env) {
    return {
        user: env.POSTGRES_USER,
        host: 'localhost',
        database: env.POSTGRES_DB,
        password: env.POSTGRES_PASSWORD,
        port: 5432,
    };
}
