import * as z from "zod";

const EnvSchema = z.object({
    NODE_ENV: z.enum([
        'development',
        'production'
    ]).default('development'),
    DEMO_JWT: z.string().transform(Number),
    DEMO_USERNAME: z.string(),
    DEMO_PASSWORD: z.string(),
    POSTGRES_USER: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_DB: z.string(),
})

const validateEnv = (rawEnv) => {
    try {
        const env = EnvSchema.parse(rawEnv);
        return {
            success: true,
            env: env
        };
    } catch(error){
        if(error instanceof z.ZodError){
            console.error(error.issues)
            return { success: false, error: error.issues };
        }

        return { success: false, error: 'Internal error' };
    }
}

export default validateEnv;