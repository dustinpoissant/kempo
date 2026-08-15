/*
  Claims an unmatched request by filling in the draft. Registered first in the ordering test.
*/
export default async ({ draft, url }) => {
  if(url !== '/claimed-by-fixture') return;
  draft.status = 200;
  draft.headers['Content-Type'] = 'text/plain';
  draft.body = 'claimed';
  draft.handled = true;
};
