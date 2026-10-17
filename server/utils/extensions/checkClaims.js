import { join } from 'path';
import readKempoConfig from './readKempoConfig.js';
import { getEnabledExtensions } from './scopeCache.js';
import { findClaimConflicts, describeConflict } from './claims.js';

const configOf = async name => {
  try {
    return { name, kempo: (await readKempoConfig(join(process.cwd(), 'node_modules', name))).kempo };
  } catch {
    return null;
  }
};

/*
  Refuses to put an extension on the site when another one that is on already uses an address it
  claims. "names" are the extensions about to be switched on (installed, or enabled together with what
  they require) and "verb" is what is being done ("install", "enable" or "update"). Returns [error] with
  a 409 and the whole list as "conflicts", or [null].

  An extension whose package cannot be read is skipped, as it cannot be routed to anyway. "kempo" gives
  the config of a name to check instead of reading it, for one that has just changed.
*/
export default async ({ names, verb, kempo = {} }) => {
  const candidates = (await Promise.all(names.map(async name => kempo[name] ? { name, kempo: kempo[name] } : configOf(name)))).filter(Boolean);
  const enabled = (await getEnabledExtensions()).map(row => row.name).filter(name => !names.includes(name));
  const others = (await Promise.all(enabled.map(configOf))).filter(Boolean);

  const conflicts = findClaimConflicts(candidates, others);
  if(!conflicts.length) return [null];

  return [{ code: 409, msg: describeConflict(conflicts[0], verb), conflicts }];
};
