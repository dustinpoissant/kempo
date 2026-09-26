import { join, resolve, sep } from 'path';
import { pathToFileURL } from 'url';
import userHasPermission from '../permissions/userHasPermission.js';
import { getEnabledExtensions } from '../extensions/scopeCache.js';
import parseDuration from './duration.js';

/*
  Channels

  A channel is named `<owner>:<name>`. The owner is an extension's package name (or `kempo` for core),
  so two extensions cannot collide on a name and a channel always says who is responsible for it.

  Channels are closed by default: one must be declared with a permission or an authorize function
  before anyone can subscribe or publish. The one exception is a user's own `user:<id>` channel, which
  is implicit and only that user may subscribe to.

  A channel comes from one of two places. Code registers it with `registerChannel`, which only works
  for something loaded at startup because nothing else runs before the first subscriber connects.
  An extension instead declares it in its kempo-config.json under `realtime.channels`; that snapshot
  is stored in the extension table when the extension is installed, so it is available to every
  process with no file access and no load-order dependency, and disabling the extension closes its
  channels.

  A channel also says how it behaves:

    scope            "cluster" (default) delivers through Postgres to subscribers on every process.
                     "process" delivers in memory to subscribers on the process that publishes, never
                     touching the database, for traffic too fast for the bus. It cannot persist.
    onMessage        Who handles a message a client sends to the channel. A function when registered in
                     code; for an extension, a path inside its own package, loaded once and kept in
                     memory, since a lookup per message would put the database on the hot path.
    dropIfBackedUp   Deliveries to a client that is already behind are skipped, for data where only the
                     newest value matters.
*/

/*
  State lives on a global keyed by Symbol.for rather than in module scope: kempo can be resolved twice
  in one process (a symlinked checkout during development, a hoisted copy beside a nested one), and a
  registration made through one copy would otherwise be invisible to the other.
*/
const REGISTRY = Symbol.for('kempo.realtime.channels');

if(!globalThis[REGISTRY]){
  globalThis[REGISTRY] = new Map();
}

const registry = () => globalThis[REGISTRY];

export const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const USER_CHANNEL_PREFIX = 'user:';

const RESERVED_OWNERS = new Set(['user']);
const OWNER_PATTERN = /^(@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/*
  Registration
*/

export const registerChannel = ({ owner, name, permission, authorize, persist = false, retention, scope = 'cluster', onMessage, dropIfBackedUp = false } = {}) => {
  if(typeof owner !== 'string' || !OWNER_PATTERN.test(owner) || RESERVED_OWNERS.has(owner)){
    return [{ code: 400, msg: 'Owner must be an extension package name (or "kempo" for core)' }, null];
  }
  if(typeof name !== 'string' || !NAME_PATTERN.test(name)){
    return [{ code: 400, msg: 'Channel name may contain letters, numbers, dots, dashes and underscores' }, null];
  }
  if(!permission && typeof authorize !== 'function'){
    return [{ code: 400, msg: 'A channel needs a permission or an authorize function, channels are closed by default' }, null];
  }
  if(permission !== undefined && (typeof permission !== 'string' || !permission)){
    return [{ code: 400, msg: 'Permission must be a permission name' }, null];
  }
  if(authorize !== undefined && typeof authorize !== 'function'){
    return [{ code: 400, msg: 'authorize must be a function' }, null];
  }

  const retentionMs = retention === undefined ? DEFAULT_RETENTION_MS : parseDuration(retention);
  if(retentionMs === null){
    return [{ code: 400, msg: 'Retention must be a positive number of milliseconds or a string like "24h"' }, null];
  }
  if(scope !== 'cluster' && scope !== 'process'){
    return [{ code: 400, msg: 'Scope must be "cluster" or "process"' }, null];
  }
  if(persist && scope === 'process'){
    return [{ code: 400, msg: 'A channel with scope "process" cannot persist, since nothing is stored' }, null];
  }
  if(onMessage !== undefined && typeof onMessage !== 'function'){
    return [{ code: 400, msg: 'onMessage must be a function' }, null];
  }

  const channel = `${owner}:${name}`;
  if(registry().has(channel)){
    return [{ code: 409, msg: `Channel "${channel}" is already registered` }, null];
  }

  registry().set(channel, {
    channel,
    owner,
    name,
    permission: permission || null,
    authorize: authorize || null,
    persist: Boolean(persist),
    retentionMs,
    scope,
    onMessage: onMessage || null,
    handlerPath: null,
    dropIfBackedUp: Boolean(dropIfBackedUp),
    source: 'code'
  });

  return [null, { channel }];
};

export const unregisterChannel = (channel) => registry().delete(channel);

/*
  Resolution
*/

export const resolveChannel = async (channel) => {
  if(typeof channel !== 'string' || !channel.includes(':')) return null;

  if(channel.startsWith(USER_CHANNEL_PREFIX)){
    const userId = channel.slice(USER_CHANNEL_PREFIX.length);
    if(!userId) return null;
    return { channel, owner: 'user', name: userId, userId, persist: false, retentionMs: DEFAULT_RETENTION_MS, scope: 'cluster', onMessage: null, handlerPath: null, dropIfBackedUp: false, source: 'implicit' };
  }

  const registered = registry().get(channel);
  if(registered) return registered;

  const separator = channel.indexOf(':');
  const owner = channel.slice(0, separator);
  const name = channel.slice(separator + 1);

  const extensions = await getEnabledExtensions();
  const declared = extensions.find(extension => extension.name === owner)?.kempo?.realtime?.channels;
  if(!Array.isArray(declared)) return null;

  const entry = declared.find(candidate => candidate && candidate.name === name);
  // A declared channel with no permission is treated as undeclared, since channels are closed by default
  if(!entry || typeof entry.permission !== 'string' || !entry.permission) return null;

  const retentionMs = entry.retention === undefined ? DEFAULT_RETENTION_MS : parseDuration(entry.retention);
  if(retentionMs === null) return null;

  /*
    Anything about the declaration that cannot be honoured closes the channel rather than quietly
    opening it with different behaviour than the extension asked for.
  */
  const scope = entry.scope === undefined ? 'cluster' : entry.scope;
  if(scope !== 'cluster' && scope !== 'process') return null;
  if(entry.persist && scope === 'process') return null;

  let handlerPath = null;
  if(entry.onMessage !== undefined){
    handlerPath = resolveHandlerPath(owner, entry.onMessage);
    if(!handlerPath) return null;
  }

  return {
    channel,
    owner,
    name,
    permission: entry.permission,
    authorize: null,
    persist: Boolean(entry.persist),
    retentionMs,
    scope,
    onMessage: null,
    handlerPath,
    dropIfBackedUp: Boolean(entry.dropIfBackedUp),
    source: 'extension'
  };
};

/*
  Message handlers

  An extension names its handler as a path inside its own package, like a hook callback. The path is
  resolved against the package and refused if it leaves it, so a manifest cannot point the server at
  arbitrary code elsewhere on disk.
*/
const resolveHandlerPath = (owner, relative) => {
  if(typeof relative !== 'string' || !relative.startsWith('./')) return null;
  const root = join(process.cwd(), 'node_modules', owner);
  const full = resolve(root, relative);
  return full.startsWith(root + sep) ? full : null;
};

const HANDLERS = Symbol.for('kempo.realtime.handlers');

if(!globalThis[HANDLERS]){
  globalThis[HANDLERS] = new Map();
}

export const clearMessageHandlerCache = () => globalThis[HANDLERS].clear();

/*
  Loaded once and kept, so handling a message never touches the database or the disk. Returns null for a
  channel that accepts no messages; throws if a declared handler cannot be loaded, which the caller
  reports rather than treating as "no handler".
*/
export const loadMessageHandler = async (config) => {
  if(typeof config.onMessage === 'function') return config.onMessage;
  if(!config.handlerPath) return null;

  let handler = globalThis[HANDLERS].get(config.handlerPath);
  if(!handler){
    const module = await import(pathToFileURL(config.handlerPath).href);
    handler = module.default || module;
    if(typeof handler !== 'function'){
      throw new Error(`${config.handlerPath} does not export a function`);
    }
    globalThis[HANDLERS].set(config.handlerPath, handler);
  }
  return handler;
};

/*
  Authorization

  Checked when a client subscribes. A permission granted or revoked afterwards does not affect a
  subscription that already exists; a session ending does, and is enforced separately.
*/

export const authorizeSubscription = async ({ config, user }) => {
  if(!user?.id) return [{ code: 401, msg: 'Authentication required' }, null];

  if(config.source === 'implicit') return [null, config.userId === user.id];

  if(config.permission){
    const [error, allowed] = await userHasPermission(user.id, config.permission);
    if(error) return [error, null];
    if(!allowed) return [null, false];
  }

  if(config.authorize){
    try {
      if(!await config.authorize({ user, channel: config.channel })) return [null, false];
    } catch(error) {
      return [{ code: 500, msg: 'Channel authorization failed' }, null];
    }
  }

  return [null, true];
};
