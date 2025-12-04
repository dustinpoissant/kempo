import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';
import * as schema from './schema.js';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client, { schema });

export default db;
