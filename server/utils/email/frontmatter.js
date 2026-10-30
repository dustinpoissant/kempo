/*
  An email template's frontmatter: the comment block at its top, which says who owns it and which variables its template can use.

    <!--
      owner: kempo-forms
      variables:
        name: The person's name, or empty when they gave none.
        email: The address they gave.
    -->

  The editor never shows the block. `splitFrontmatter` takes it off the source, `variables` lists what it declares, and
  `joinFrontmatter` puts the block back on a body the editor saved, so the declarations are kept as they were.
*/
const BLOCK = /^\s*<!--[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*-->[ \t]*(\r?\n)?/;

export const splitFrontmatter = source => {
  const text = String(source ?? '');
  const match = BLOCK.exec(text);
  if(!match) return { frontmatter: '', body: text, owner: null, variables: [] };

  const variables = [];
  let owner = null;
  let inVariables = false;
  const lines = match[1].split(/\r?\n/).filter(line => line.trim());
  const indent = Math.min(...lines.map(line => line.match(/^\s*/)[0].length));
  for(const line of lines.map(line => line.slice(indent))){
    if(/^\s/.test(line)){
      const entry = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
      if(inVariables && entry) variables.push({ name: entry[1], description: entry[2].trim() });
      continue;
    }
    const field = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line.trim());
    inVariables = field?.[1] === 'variables';
    if(field?.[1] === 'owner') owner = field[2].trim() || null;
  }
  return { frontmatter: match[0], body: text.slice(match[0].length), owner, variables };
};

/* The body with the frontmatter in front of it again. A body without a block of its own takes the given one. */
export const joinFrontmatter = (frontmatter, body) => {
  const text = String(body ?? '');
  if(BLOCK.test(text) || !frontmatter) return text;
  return /\r?\n$/.test(frontmatter) ? frontmatter + text : `${frontmatter}\n${text}`;
};
