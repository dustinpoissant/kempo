import db from '../../db/index.js';
import { extension } from '../../db/schema.js';

/*
  What an extension needs in order to run, followed all the way down: the extensions it requires, the
  ones those require, and so on.

    disabled   installed but switched off, so they have to be enabled first. Each says which of its
               own requirements it needs, and they come dependencies-first, the order they could be
               enabled one at a time.
    missing    not installed at all. Enabling cannot fix that.

  The mirror of getDependentTree.js, which walks the other way (what needs this one).
*/
export default async name => {
  const rows = await db.select({ name: extension.name, kempo: extension.kempo, enabled: extension.enabled }).from(extension);
  const byName = new Map(rows.map(row => [row.name, row]));

  const disabled = [];
  const missing = [];
  const seen = new Set([name]);

  const visit = current => {
    for(const required of byName.get(current)?.kempo?.dependencies || []){
      if(seen.has(required)) continue;
      seen.add(required);

      const row = byName.get(required);
      if(!row){
        missing.push(required);
        continue;
      }

      visit(required);
      if(!row.enabled){
        disabled.push({ name: required, requires: (row.kempo?.dependencies || []).filter(need => byName.has(need)) });
      }
    }
  };
  visit(name);

  return { disabled, missing };
};
