import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

/*
  Everything that has to be switched off along with `name`: the enabled extensions that require it, the
  enabled extensions that require those, and so on. Each entry says which members of the affected set
  (the extension itself included) it requires directly, so the chain can be shown. Deepest dependents
  first, which is the order they would have to be switched off one at a time.
*/
export default async name => {
  const rows = await db.select({ name: extension.name, kempo: extension.kempo })
    .from(extension)
    .where(eq(extension.enabled, true));

  const requires = new Map(rows.map(row => [row.name, row.kempo?.dependencies || []]));
  const depth = new Map([[name, 0]]);
  let frontier = [name];

  while(frontier.length){
    const next = [];
    for(const [candidate, needs] of requires){
      if(depth.has(candidate)) continue;
      if(needs.some(need => frontier.includes(need))){
        depth.set(candidate, depth.get(frontier.find(need => needs.includes(need))) + 1);
        next.push(candidate);
      }
    }
    frontier = next;
  }

  return [...depth.entries()]
    .filter(([candidate]) => candidate !== name)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([candidate]) => ({ name: candidate, requires: requires.get(candidate).filter(need => depth.has(need)) }));
};
