// This file must be imported first to load environment variables
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from server directory
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Verify critical environment variables and provide helpful errors
const requiredEnvVars = {
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
};

const missing = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
console.error(`
⚠️  Missing required environment variables: ${missing.join(', ')}

Please check your server/.env file and ensure all required variables are set.

Required variables:
${Object.keys(requiredEnvVars).map(key => `  - ${key === 'FIREBASE_SERVICE_ACCOUNT' ? 'FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH' : key}`).join('\n')}

Get Firebase service account from: Firebase Console > Project Settings > Service Accounts
Get Firebase Realtime Database URL from: Firebase Console > Build > Realtime Database (copy connection URL)
  `.trim());
}

export default process.env;

