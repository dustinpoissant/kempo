export default content => {
  const match = content.match(/^<!--\s*\n([\s\S]*?)\n\s*-->/);
  if(!match) return {};
  const meta = {};
  for(const line of match[1].split('\n')){
    const idx = line.indexOf(':');
    if(idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if(key) meta[key] = value;
  }
  return meta;
};
