/*
  Loaded with `--import` by scripts/run-tests.js in the unit tier, before any test file.

  The in-memory database is created on first import of server/db/index.js. Some test files install
  fake browser globals (a `window`, for example) that make PGlite take its browser code path, so
  letting whichever suite imports the database first create it would make the run depend on file
  order. Creating it here, in a clean process, removes that.
*/
if(process.env.KEMPO_DB === 'pglite'){
  await import('../../server/db/index.js');
}
