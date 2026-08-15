/*
  Claims a request by pointing at a file on disk rather than supplying a body, which is how a gated
  download keeps Range/206 support: the handler only describes what to serve, and serveUnmatched
  streams it through kempo-server's own helper.

  The path is read from an environment variable so the test can point it at a temp file.
*/
export default async ({ draft, url }) => {
  if(url !== '/claimed-by-file') return;
  draft.filePath = process.env.KEMPO_TEST_FIXTURE_FILE;
  draft.headers['Content-Type'] = 'text/plain';
  draft.headers['X-Content-Type-Options'] = 'nosniff';
  draft.handled = true;
};
