const pendingRequests = new Map();

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
        return [{ code: response.status, msg: errorData.error || errorData.message || 'An error occurred' }, null];
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
      return [{ code: response.status, msg: errorData.error || errorData.message || 'An error occurred' }, null];
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
      return dedupFetch(`${url}?${queryString}`, { method: 'GET' });
    }
  }
  return dedupFetch(url, { method: 'GET' });
};

export const post = (url, data) => dedupFetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const put = (url, data) => dedupFetch(url, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const patch = (url, data) => dedupFetch(url, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const del = (url, data) => dedupFetch(url, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
