import { readdir } from 'fs/promises';
import { join } from 'path';

const scanDir = async (dir, rootDir, visitor) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = [];
  for(const entry of entries){
    if(entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = join(dir, entry.name);
    const item = await visitor(fullPath, entry, rootDir);
    if(item != null) results.push(...[].concat(item));
    if(entry.isDirectory()){
      const sub = await scanDir(fullPath, rootDir, visitor);
      results.push(...sub);
    }
  }
  return results;
};

export default scanDir;
