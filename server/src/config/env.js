/**
 * Environment Configuration
 * Loads environment variables from .env file
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory (2 levels up from config/)
const envPath = resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

export default process.env;
