/*
  A path on this site and nothing else, or an empty string. A `?next=` is attacker-controlled, and a
  login page is the worst place for an open redirect: the link is trusted right up until the
  password is typed. Refused: anything not starting with a single `/` (so no `https://…` and no
  scheme-relative `//host`), backslashes (browsers read `/\host` as `//host`), and control characters.
*/
export default value => {
  if(typeof value !== 'string' || value.length > 2048) return '';
  if(!value.startsWith('/') || value.startsWith('//')) return '';
  if(/[\\\u0000-\u001f\u007f]/.test(value)) return '';
  return value;
};
