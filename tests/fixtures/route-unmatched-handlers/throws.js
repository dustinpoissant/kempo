/*
  A handler that blows up. The chain must absorb it: later handlers still run and the site's 404
  still renders, rather than one broken extension taking every unmatched URL down with it.
*/
export default async () => {
  throw new Error('handler exploded');
};
