import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/*
  An extension declares the other extensions it requires via kempo-config.json's `dependencies`
  array (a list of extension names). Enforced at install/enable time (a dependency must already be
  enabled) and in reverse at disable/uninstall time (nothing enabled may be left depending on an
  extension that is going away).
*/

export const getUnmetDependencies = async (dependencies = []) => {
  if(!dependencies.length) return [];
  const rows = await db.select({ name: extension.name, enabled: extension.enabled }).from(extension);
  const enabled = new Set(rows.filter(row => row.enabled).map(row => row.name));
  return dependencies.filter(dep => !enabled.has(dep));
};

export const getEnabledDependents = async (name) => {
  const rows = await db.select({ name: extension.name, kempo: extension.kempo })
    .from(extension)
    .where(eq(extension.enabled, true));
  return rows
    .filter(row => row.name !== name && (row.kempo?.dependencies || []).includes(name))
    .map(row => row.name);
};
