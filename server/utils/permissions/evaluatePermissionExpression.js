/*
  Evaluates a permission expression such as `permissionA || (permissionB && permissionC)` against the permissions a
  person holds. `&&` binds tighter than `||`, and parentheses group. A name is any run of characters other than
  whitespace, parentheses, `|` and `&`, so `system:pages:update` and `my-ext.read` are single names.

  `isAdmin` means the person holds every permission (the Administrators group does), so no name is looked up.
*/
const TOKEN = /\s*(\|\||&&|\(|\)|[^\s()|&]+)/y;

const tokenize = expression => {
  const tokens = [];
  let consumed = 0;
  TOKEN.lastIndex = 0;
  let match;
  while((match = TOKEN.exec(expression))){
    tokens.push(match[1]);
    consumed = TOKEN.lastIndex;
  }
  const rest = expression.slice(consumed).trim();
  return rest ? [null, rest] : [tokens, null];
};

export default ({ expression, permissions = [], isAdmin = false }) => {
  if(typeof expression !== 'string' || !expression.trim()){
    return [{ code: 400, msg: 'A permission expression is required' }, null];
  }

  const [tokens, leftover] = tokenize(expression);
  if(!tokens){
    return [{ code: 400, msg: `Unexpected "${leftover[0]}" in permission expression` }, null];
  }

  const held = new Set(permissions);
  let position = 0;
  let failure = null;

  const fail = msg => {
    failure ??= { code: 400, msg };
    return false;
  };

  const parseOr = () => {
    let result = parseAnd();
    while(!failure && tokens[position] === '||'){
      position++;
      const right = parseAnd();
      result = result || right;
    }
    return result;
  };

  const parseAnd = () => {
    let result = parsePrimary();
    while(!failure && tokens[position] === '&&'){
      position++;
      const right = parsePrimary();
      result = result && right;
    }
    return result;
  };

  const parsePrimary = () => {
    const token = tokens[position];
    if(token === undefined) return fail('Permission expression ends unexpectedly');
    if(token === '('){
      position++;
      const result = parseOr();
      if(failure) return false;
      if(tokens[position] !== ')') return fail('Missing ")" in permission expression');
      position++;
      return result;
    }
    if(token === ')' || token === '||' || token === '&&') return fail(`Unexpected "${token}" in permission expression`);
    position++;
    return isAdmin || held.has(token);
  };

  const result = parseOr();
  if(!failure && position < tokens.length) fail(`Unexpected "${tokens[position]}" in permission expression`);

  return failure ? [failure, null] : [null, result];
};
