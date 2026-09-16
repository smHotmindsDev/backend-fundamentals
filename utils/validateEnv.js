// Boot-time config validation. The server must refuse to start on bad config,
// so the caller checks `success` before creating a pool or calling listen().
//
// Only variables the Part C API needs. The Part A demo login (DEMO_*) is gone.

import * as z from 'zod';

export const EnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8000),

    // Auth-lite: the single API key clients send in X-API-Key.
    API_KEY: z.string().min(1),

    POSTGRES_USER: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_HOST: z.string().min(1).default('localhost'),
    POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
});

const formatIssues = (issues) =>
    issues.map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');

const validateEnv = (rawEnv) => {
    const result = EnvSchema.safeParse(rawEnv);

    if (result.success) {
        return { success: true, env: result.data };
    }

    console.error(`Invalid environment configuration:\n${formatIssues(result.error.issues)}`);
    return { success: false, error: result.error.issues };
};

export default validateEnv;
