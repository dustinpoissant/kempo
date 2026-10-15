import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/*
  Everything that has to go along with `name`: the extensions that require it, the ones that require
  those, and so on. Each entry says which members of the affected set (the extension itself included)
  it requires directly, so the chain can be shown, and whether it is currently enabled. Deepest
  dependents first, which is the order they would have to be dealt with one at a time.

  By default only enabled extensions count, which is what disabling needs: one that is already off
  does not have to be switched off again. Uninstalling needs `includeDisabled`, because an extension
  that is installed but switched off is still installed, and must not be left behind without what it
  requires.
*/
export default async (name, { includeDisabled = false } = {}) => {
  const rows = await (includeDisabled
    ? db.select({ name: extension.name, kempo: extension.kempo, enabled: extension.enabled }).from(extension)
    : db.select({ name: extension.name, kempo: extension.kempo, enabled: extension.enabled }).from(extension).where(eq(extension.enabled, true)));

  const requires = new Map(rows.map(row => [row.name, row.kempo?.dependencies || []]));
  const enabled = new Map(rows.map(row => [row.name, row.enabled]));
  const depth = new Map([[name, 0]]);
  let frontier = [name];

  while(frontier.length){
    const next = [];
    for(const [candidate, needs] of requires){
      if(depth.has(candidate)) continue;
      const via = frontier.find(need => needs.includes(need));
      if(via !== undefined){
        depth.set(candidate, depth.get(via) + 1);
        next.push(candidate);
      }
    }
    frontier = next;
  }

  return [...depth.entries()]
    .filter(([candidate]) => candidate !== name)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([candidate]) => ({
      name: candidate,
      requires: requires.get(candidate).filter(need => depth.has(need)),
      enabled: enabled.get(candidate) === true,
    }));
};
