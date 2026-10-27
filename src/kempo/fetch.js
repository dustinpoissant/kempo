const pendingRequests = new Map();

const CACHE_MS = 5000;
const cache = new Map();

/* A write may change any list it touches, so every cached read is dropped before and after it. */
const mutate = async (url, options) => {
  cache.clear();
  try {
    return await dedupFetch(url, options);
  } finally {
    cache.clear();
  }
};

/* A read that succeeded is kept for a few seconds, and each caller gets its own copy so a table can change what it is given. */
const cachedGet = async url => {
  const hit = cache.get(url);
  if(hit && Date.now() - hit.at < CACHE_MS) return structuredClone(hit.result);
  const result = await dedupFetch(url, { method: 'GET' });
  if(!result[0]) cache.set(url, { at: Date.now(), result: structuredClone(result) });
  return result;
};

const createRequestKey = (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body || '';
  return `${method}:${url}:${body}`;
};

const dedupFetch = async (url, options) => {
  const key = createRequestKey(url, options);
  if(pendingRequests.has(key)){
    const existingRequest = pendingRequests.get(key);
    return new Promise((resolve, reject) => {
      existingRequest.callbacks.add({ resolve, reject });
    }).then(async response => {
      if(!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch(e) {
          return [{ code: response.status, msg: 'Service temporarily unavailable. Please try again later.' }, null];
        }
        return [{ code: response.status, msg: errorData.error || errorData.message || 'An error occurred', ...(errorData.details ? { details: errorData.details } : {}) }, null];
      }
      try {
        return [null, await response.json()];
      } catch(e) {
        return [{ code: 500, msg: 'Service temporarily unavailable. Please try again later.' }, null];
      }
    });
  }
  const callbacks = new Set();
  const fetchPromise = fetch(url, options)
    .then(response => {
      callbacks.forEach(({ resolve }) => resolve(response.clone()));
      pendingRequests.delete(key);
      return response;
    })
    .catch(error => {
      callbacks.forEach(({ reject }) => reject(error));
      pendingRequests.delete(key);
      throw error;
    });
  pendingRequests.set(key, { fetchPromise, callbacks });
  try {
    const response = await fetchPromise;
    if(!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch(e) {
        return [{ code: response.status, msg: 'Service temporarily unavailable. Please try again later.' }, null];
      }
      return [{ code: response.status, msg: errorData.error || errorData.message || 'An error occurred', ...(errorData.details ? { details: errorData.details } : {}) }, null];
    }
    try {
      return [null, await response.json()];
    } catch(e) {
      return [{ code: 500, msg: 'Service temporarily unavailable. Please try again later.' }, null];
    }
  } catch(error) {
    if(error.message === 'Service temporarily unavailable. Please try again later.' || error.message.includes('Failed to fetch')) {
      return [{ code: 503, msg: 'Service temporarily unavailable. Please try again later.' }, null];
    }
    return [{ code: 500, msg: error.message || 'An error occurred' }, null];
  }
};

export const get = (url, params) => {
  if(params){
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if(entries.length){
      const queryString = entries
        .map(([key, value]) => {
          if(Array.isArray(value)){
            return `${encodeURIComponent(key)}=${value.map(v => encodeURIComponent(v)).join(',')}`;
          }
          return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        })
        .join('&');
      return cachedGet(`${url}?${queryString}`);
    }
  }
  return cachedGet(url);
};

export const post = (url, data) => mutate(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const put = (url, data) => mutate(url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const patch = (url, data) => mutate(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const del = (url, data) => mutate(url, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
