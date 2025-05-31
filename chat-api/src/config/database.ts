import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' })

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in the environment variables");
}

// Create a Neon database client
const sql = neon(process.env.DATABASE_URL)

// Create a Drizzle ORM instance
export const db = drizzle(sql)