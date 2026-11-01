/*
  JavaScript written in a Script widget is the body of one <script>. The script's own closing tag cannot be in its code,
  so it is written as <\/script, which means the same in JavaScript.
*/

/* The code as it goes between <script> and </script>. */
export const writeCode = code => `\n${String(code ?? '').replace(/\s+$/, '').replace(/<\/(script)/gi, '<\\/$1')}\n`;

/* The code back out of what was between the tags. */
export const readCode = body => String(body ?? '').replace(/^\n|\n[ \t]*$/g, '').replace(/<\\\/(script)/gi, '</$1');
