import { pgTable, text } from 'drizzle-orm/pg-core';

export const lifecycleFixtureItem = pgTable('lifecycleFixtureItem', {
  id: text('id').primaryKey(),
  label: text('label'),
});
