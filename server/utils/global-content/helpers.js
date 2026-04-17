import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const GLOBAL_FILE = 'kempo-global.global.html';

const parseEntries = raw => {
  const entries = [];
  const regex = /<content\s([^>]*)>([\s\S]*?)<\/content>/g;
  let match;
  while((match = regex.exec(raw)) !== null){
    const attrs = {};
    const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
    let a;
    while((a = attrRegex.exec(match[1])) !== null) attrs[a[1]] = a[2];
    entries.push({
      id: attrs.id || '',
      name: attrs.name || '',
      owner: attrs.owner || 'custom',
      author: attrs.author || '',
      locked: attrs.locked === 'true',
      location: attrs.location || 'default',
      priority: parseInt(attrs.priority || '0', 10),
      createdAt: attrs.created || '',
      updatedAt: attrs.updated || '',
      markup: match[2].trim()
    });
  }
  return entries;
};

export { GLOBAL_FILE, parseEntries };
