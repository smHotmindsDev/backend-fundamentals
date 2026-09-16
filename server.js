import {Pool} from "pg";
import { createConfig } from './config.js';
import { createApp } from './src/app.js';
import validateEnv from "./src/utils/validateEnv.js";

const result = validateEnv(process.env);
if (!result.success) process.exit(1);
const env = result.env;

const dbClient = new Pool(createConfig(env));
const app = createApp({ env, dbClient });
app.listen(env.PORT);