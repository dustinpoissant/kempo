export const LEVELS = ['info', 'success', 'warning', 'error'];
export const API_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
export const MAX_ACTIONS = 3;
export const MAX_TITLE_LENGTH = 200;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_LABEL_LENGTH = 40;
export const MAX_URL_LENGTH = 2048;
export const MAX_BODY_BYTES = 4096;
export const DEFAULT_RETENTION_DAYS = 90;
export const MAX_PAGE_SIZE = 100;

/*
  A path on this site and nothing else. It must begin with exactly one slash: `//host` and `/\\host`
  are read by browsers as another origin, and `javascript:` or `https:` URLs do not begin with a slash
  at all. Whitespace, backslashes and control characters are refused because browsers strip or
  rewrite some of them before resolving, which is how a path that looks safe becomes an external one.
*/
export const isLocalPath = value =>
  typeof value === 'string' &&
  value.length <= MAX_URL_LENGTH &&
  /^\/(?![/\\])[^\\\s\u0000-\u001f\u007f]*$/.test(value);

/*
  Returns the actions reduced to the known fields, so nothing a caller passes beyond them is stored.
  An action is either a link (`href`) or a call (`api`), never both.
*/
export const validateActions = actions => {
  if(actions === undefined || actions === null){
    return [null, []];
  }

  if(!Array.isArray(actions) || actions.length > MAX_ACTIONS){
    return [{ code: 400, msg: `actions must be an array of at most ${MAX_ACTIONS} items` }, null];
  }

  const clean = [];

  for(const action of actions){
    if(!action || typeof action !== 'object' || Array.isArray(action)){
      return [{ code: 400, msg: 'Each action must be an object' }, null];
    }

    const { label, href, api } = action;

    if(typeof label !== 'string' || !label.trim() || label.length > MAX_LABEL_LENGTH){
      return [{ code: 400, msg: `Each action needs a label of at most ${MAX_LABEL_LENGTH} characters` }, null];
    }

    if((href === undefined) === (api === undefined)){
      return [{ code: 400, msg: 'Each action needs exactly one of href or api' }, null];
    }

    if(href !== undefined){
      if(!isLocalPath(href)){
        return [{ code: 400, msg: 'An action href must be a path on this site, beginning with a single "/"' }, null];
      }
      clean.push({ label: label.trim(), href });
      continue;
    }

    if(!api || typeof api !== 'object' || Array.isArray(api)){
      return [{ code: 400, msg: 'An action api must be an object with a method and url' }, null];
    }

    const method = typeof api.method === 'string' ? api.method.toUpperCase() : '';

    if(!API_METHODS.includes(method)){
      return [{ code: 400, msg: `An action api method must be one of ${API_METHODS.join(', ')}` }, null];
    }

    if(!isLocalPath(api.url)){
      return [{ code: 400, msg: 'An action api url must be a path on this site, beginning with a single "/"' }, null];
    }

    const cleanApi = { method, url: api.url };

    if(api.body !== undefined){
      let serialized;
      try {
        serialized = JSON.stringify(api.body);
      } catch {
        serialized = undefined;
      }
      if(serialized === undefined || Buffer.byteLength(serialized) > MAX_BODY_BYTES){
        return [{ code: 400, msg: `An action api body must be JSON of at most ${MAX_BODY_BYTES} bytes` }, null];
      }
      cleanApi.body = JSON.parse(serialized);
    }

    clean.push({ label: label.trim(), api: cleanApi });
  }

  return [null, clean];
};
