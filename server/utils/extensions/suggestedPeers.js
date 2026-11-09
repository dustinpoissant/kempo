import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { NAME_PATTERN } from './marketplaceClient.js';

const MAX_REASON = 200;

/*
  The other extensions an extension works better with, declared in its kempo-config.json as `suggestedPeers`: a list of
  names, or of objects with a `name` and a `reason` the administrator reads ("Pictures and videos for products").

    "suggestedPeers": ["kempo-thumbs", { "name": "kempo-media", "reason": "Pictures and videos for products" }]

  It is advice only. Nothing here is required, installed or enabled for the extension: that is what `dependencies` is for.
  An extension that works without another one but does more with it (an optional integration) suggests it.
*/
export const normalizeSuggestedPeers = (value, owner = '') => {
  if(value === undefined || value === null) return [null, []];
  if(!Array.isArray(value)) return [{ code: 400, msg: '`suggestedPeers` must be a list' }, null];

  const peers = [];
  for(const entry of value){
    const name = typeof entry === 'string' ? entry : entry?.name;
    const reason = typeof entry === 'string' ? '' : entry?.reason;
    if(typeof name !== 'string' || !NAME_PATTERN.test(name)) return [{ code: 400, msg: `\`suggestedPeers\` has "${name}", which is not a valid package name` }, null];
    if(reason !== undefined && typeof reason !== 'string') return [{ code: 400, msg: `\`suggestedPeers\` gives "${name}" a reason that is not text` }, null];
    if(name === owner || peers.some(peer => peer.name === name)) continue;
    peers.push({ name, reason: String(reason || '').trim().slice(0, MAX_REASON) });
  }
  return [null, peers];
};

/*
  What the given extensions suggest that the site does not run yet, from the rows of the extension table (`{ name, enabled,
  kempo }`): `[{ name, reason, status, suggestedBy }]`. `status` is `missing` (not installed) or `disabled` (installed and
  switched off); `suggestedBy` names the extensions that suggest it, and the first reason given is kept. A suggestion that is
  installed and enabled, or is one of the given extensions, is left out. A bad declaration is reported on the server and
  gives no suggestions, so it cannot break the admin.
*/
export const suggestionsFor = (rows, names) => {
  const state = new Map(rows.map(row => [row.name, row.enabled]));
  const found = new Map();
  for(const name of names){
    const row = rows.find(other => other.name === name);
    if(!row) continue;
    const [error, peers] = normalizeSuggestedPeers(row.kempo?.suggestedPeers, name);
    if(error){
      console.warn(`[${name}] suggestedPeers ignored: ${error.msg}`);
      continue;
    }
    for(const peer of peers){
      if(state.get(peer.name) === true || names.includes(peer.name)) continue;
      const entry = found.get(peer.name) ?? { name: peer.name, reason: '', status: state.has(peer.name) ? 'disabled' : 'missing', suggestedBy: [] };
      entry.reason ||= peer.reason;
      entry.suggestedBy.push(name);
      found.set(peer.name, entry);
    }
  }
  return [...found.values()];
};

/*
  What one or more installed extensions suggest: `{ suggestions }` (see suggestionsFor). It is what an install or an enable
  offers, for everything it added, the extensions it needed included. One name that is not installed is a 404; with several,
  the ones that are not installed are skipped.
*/
export const getSuggestedPeers = async ({ names }) => {
  const list = [...new Set((Array.isArray(names) ? names : [names]).filter(name => typeof name === 'string' && name))];
  if(!list.length) return [{ code: 400, msg: 'Extension name is required' }, null];

  let rows;
  try {
    rows = await db.select({ name: extension.name, enabled: extension.enabled, kempo: extension.kempo }).from(extension);
  } catch {
    return [{ code: 500, msg: 'Failed to read the extensions' }, null];
  }

  if(list.length === 1 && !rows.some(row => row.name === list[0])) return [{ code: 404, msg: 'Extension is not installed' }, null];

  return [null, { suggestions: suggestionsFor(rows, list) }];
};
