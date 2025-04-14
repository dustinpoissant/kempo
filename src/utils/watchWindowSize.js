import debounce from './debounce.js';

const handlers = new Set();
window.addEventListener('resize', debounce(()=>{
  const width = window.innerWidth;
  handlers.forEach( (handler) => handler(width));
}));

export const watchWindowSize = (handler) => {
  handlers.add(handler);
  return window.innerWidth;
}
export const unwatchWindowSize = (handler) => {
  handlers.remove(handler);
}
