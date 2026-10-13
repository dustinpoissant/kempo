import { pgTable, text } from 'drizzle-orm/pg-core';

export const fixtureOwnTable = pgTable('fixtureOwnTable', { id: text('id').primaryKey() });
