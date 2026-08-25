/*
  A declared setting's default, turned into the value `setSetting` expects.

  kempo-config.json declares defaults as strings — `"value": "10"` for a number, `"value": "true"`
  for a boolean — and that is what the extension docs tell authors to write. `setSetting` takes the
  *real* value and serialises it according to the type it is given, and for every scalar type the
  two happen to agree: `serializeValue('10', 'number')` is `String('10')`, which is `'10'`.

  For `json` they do not. A declared `"value": "[{\"label\":\"sm\"}]"` is a string, and
  `serializeValue(aString, 'json')` is `JSON.stringify(aString)` — the array gets encoded a second
  time, and reading the setting back returns the JSON *text* rather than the array. Nothing errors;
  the extension simply behaves as though the setting were empty, which is a very quiet way to break.

  So a json default is parsed here before it is stored. A value that is already a real array or
  object (perfectly legal in kempo-config.json, and what you get if you write the JSON inline) is
  passed through untouched, and a string that is not valid JSON is left as-is rather than thrown —
  a malformed default is the author's problem to see in their own settings screen, not a reason to
  fail the whole install.
*/
export default (value, type) => {
  if(type !== 'json' || typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
