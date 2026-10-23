export const PACKAGE = 'kempo';

export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/* Only plain releases are ever installed by an update: no tags, ranges or prereleases, so nothing here can reach a shell as anything else. */
export const isVersion = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);

/* -1, 0 or 1 for a compared with b, both plain versions. */
export const compareVersions = (a, b) => {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for(let i = 0; i < 3; i++){
    if(left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
};

/*
  Whether going from one plain version to a higher one may break what depended on it, by semver: a new major version, and
  while the major is still 0 a new minor version too (0.1.x to 0.2.0 is the breaking step there, which is what npm's own ^0.1.1
  assumes). Every extension kempo has is still 0.x, so this is what makes its updates warn.
*/
export const isBreakingBump = (from, to) => {
  const [fromMajor, fromMinor] = from.split('.').map(Number);
  const [toMajor, toMinor] = to.split('.').map(Number);
  return fromMajor === 0 ? (toMajor > 0 || toMinor > fromMinor) : toMajor > fromMajor;
};

/* The version a peer range such as ">=2.2.5" or "^3.4.0" starts at, or null for one that names none ("*"). */
export const lowerBound = range => String(range).match(/\d+\.\d+\.\d+/)?.[0] ?? null;
