import debounce from"./debounce.js";const handlers=new Set;window.addEventListener("resize",debounce((()=>{const e=window.innerWidth;handlers.forEach((n=>n(e)))})));export const watchWindowSize=e=>(handlers.add(e),window.innerWidth);export const unwatchWindowSize=e=>{handlers.remove(e)};