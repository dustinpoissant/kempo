import { scopeNames } from './scopes.js';
import { normalizeAliases } from './aliases.js';

/*
  An address an extension answers on is a *claim*, and the router can give an address to only one
  extension. Whichever one it reaches first gets every request for it, and the other's pages, scripts
  and API routes under it answer 404 without any error, so two extensions may not claim the same
  address or one inside the other.

  Every claim is a path: each of the extension's scopes (/products) and each of its alias addresses
  (/cart). An alias that is invalid is left out here, since it is refused on its own.
*/
export const claimsOf = kempo => {
  const names = scopeNames(kempo);
  const [, aliases] = normalizeAliases(kempo?.aliases, names);
  return [...names.map(scope => `/${scope}`), ...Object.keys(aliases ?? {})];
};

/* Two claims collide when they are the same address, or one is inside the other. */
export const overlaps = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

/*
  The collisions between extensions. "candidates" is what is about to be installed or switched on and
  "others" what is on already, both as [{ name, kempo }]. Candidates are checked against each other as
  well. Returns [{ name, claim, other, otherClaim }], one per colliding pair of claims. An extension
  never collides with itself, so one that claims a scope and an alias in another of its own is fine.
*/
export const findClaimConflicts = (candidates, others) => {
  const withClaims = list => list.map(({ name, kempo }) => ({ name, claims: claimsOf(kempo) }));
  const mine = withClaims(candidates);
  const theirs = withClaims(others);
  const conflicts = [];

  const compare = (left, right) => {
    for(const claim of left.claims){
      for(const otherClaim of right.claims){
        if(overlaps(claim, otherClaim)) conflicts.push({ name: left.name, claim, other: right.name, otherClaim });
      }
    }
  };

  mine.forEach((left, index) => {
    theirs.filter(right => right.name !== left.name).forEach(right => compare(left, right));
    mine.slice(index + 1).forEach(right => compare(left, right));
  });

  return conflicts;
};

/* The sentence a person is shown, naming who holds the address and what to do about it. */
export const describeConflict = ({ name, claim, other, otherClaim }, verb) => {
  const what = claim === otherClaim ? otherClaim : `${otherClaim}, which overlaps ${claim}`;
  return `Cannot ${verb} ${name}: ${other} already uses ${what}. Disable or uninstall ${other} first.`;
};
