/*
  Walks a stylesheet's rules, so the email CSS steps (the mail-client filter and the tree shaker) can each change selectors or
  declarations without parsing the CSS again. `selector(prelude)` gets a rule's selector list and returns the list to keep, or ''
  to drop the rule; `declarations(body)` gets a rule's declarations and returns those to keep. `@media` keeps its rules; other
  at-rules (`@font-face`, `@keyframes`, `@import`, `@supports`) are dropped.
*/
export const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

export const transformRules = (css, { selector, declarations }) => {
  const text = stripComments(String(css ?? ''));
  let out = '';
  let index = 0;
  while(index < text.length){
    const open = text.indexOf('{', index);
    if(open === -1) break;
    const semicolon = text.indexOf(';', index);
    if(semicolon !== -1 && semicolon < open){
      index = semicolon + 1;
      continue;
    }
    const prelude = text.slice(index, open).trim();
    let depth = 1;
    let close = open + 1;
    while(close < text.length && depth){
      if(text[close] === '{') depth++;
      else if(text[close] === '}') depth--;
      close++;
    }
    const body = text.slice(open + 1, close - 1);
    index = close;

    if(prelude.startsWith('@media')){
      const inner = transformRules(body, { selector, declarations });
      if(inner) out += `${prelude}{${inner}}`;
    } else if(!prelude.startsWith('@')){
      const kept = selector(prelude);
      const decls = declarations(body);
      if(kept && decls) out += `${kept}{${decls}}`;
    }
  }
  return out;
};
