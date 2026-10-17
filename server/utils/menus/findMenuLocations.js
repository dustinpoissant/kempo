import { readFile } from 'fs/promises';
import scanDir from '../fs/scanDir.js';

const LOCATION_TAG = /<location((?:[^>"']|"[^"]*"|'[^']*')*?)(?:\s*\/>|>[\s\S]*?<\/location>)/g;
const SOURCE_FILE = /\.(template|fragment|page)\.html$/;

/*
  A location is a menu when the template, fragment or page that holds it says so:
  `<location name="main-nav-links" label="Main menu" menu="true" />`. Looking in the site's own files
  means the Menus page lists exactly the slots this site's theme has, and a theme with no menu slot
  simply has no menus.
*/
export default async ({ rootDir }) => {
  if(!rootDir){
    return [{ code: 400, msg: 'Root directory is required' }, null];
  }

  const found = await scanDir(rootDir, rootDir, async (fullPath, entry) => {
    if(entry.isDirectory() || !SOURCE_FILE.test(entry.name)) return null;
    const content = await readFile(fullPath, 'utf-8');
    const locations = [];
    let match;
    LOCATION_TAG.lastIndex = 0;
    while((match = LOCATION_TAG.exec(content)) !== null){
      const attr = name => {
        const value = new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`).exec(match[1]);
        return value ? (value[1] ?? value[2]) : undefined;
      };
      if(attr('menu') !== 'true') continue;
      locations.push({ location: attr('name') ?? 'default', label: attr('label') ?? '' });
    }
    return locations;
  });

  const byName = new Map();
  for(const { location, label } of found){
    if(!byName.has(location) || (!byName.get(location).label && label)) byName.set(location, { location, label: label || location });
  }

  return [null, [...byName.values()]];
};
