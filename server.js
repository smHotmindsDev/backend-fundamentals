import { Pool } from 'pg';
import { createConfig } from './config.js';
import { createApp } from './src/app.js';
import logger from './src/utils/logger.js';
import validateEnv from './src/utils/validateEnv.js';

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.fatal({ err }, 'UNHANDLED REJECTION! 💥 Shutting down...');
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'UNCAUGHT EXCEPTION! 💥 Shutting down...');
    process.exit(1);
});

const result = validateEnv(process.env);
if (!result.success) process.exit(1);
const env = result.env;

const dbClient = new Pool(createConfig(env));
const app = createApp({ env, dbClient });

app.listen(env.PORT);
