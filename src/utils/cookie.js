export const saveCookie = (name, value, minutes = 30 * 24 * 60, path = '/') => {
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=${path}`;
};

export const getCookie = (name) => {
  const cookies = document.cookie.split(';').map(cookie => cookie.trim().split('='));
  const cookie = cookies.find(cookie => cookie[0] === name);
  return cookie ? cookie[1] : null;
};

export const deleteCookie = (name) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
};

export default {
  saveCookie,
  getCookie,
  deleteCookie
};
