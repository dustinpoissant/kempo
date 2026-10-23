import getSenderFrom from './getSenderFrom.js';

/*
  The bare address kempo sends its emails from (`shop@example.com`, out of `Shop <shop@example.com>`), for an extension that needs
  one for the site, such as a shipping label's sender. It is the same address emails go out from (see getSenderFrom), so it is a
  placeholder (noreply@example.com) until the site sets one. Resolves to the address, or null if there is none to find.
*/
export default async () => {
  const from = (await getSenderFrom()).trim();
  return (/<([^<>\s]+@[^<>\s]+)>/.exec(from) ?? /^([^<>\s]+@[^<>\s]+)$/.exec(from))?.[1] ?? null;
};
