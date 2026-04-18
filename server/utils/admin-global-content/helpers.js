import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const ADMIN_GLOBAL_FILE = 'kempo-global.global.html';

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
      locked: attrs.locked === 'true',
      enabled: attrs.enabled !== 'false',
      location: attrs.location || 'default',
      priority: parseInt(attrs.priority || '0', 10),
      createdAt: attrs.created || '',
      updatedAt: attrs.updated || '',
      markup: match[2].trim(),
    });
  }
  return entries;
};

const serializeEntries = entries => entries.map(e => {
  const attrs = [
    `id="${e.id}"`,
    `name="${e.name}"`,
    `owner="${e.owner}"`,
    `enabled="${e.enabled}"`,
    `created="${e.createdAt}"`,
    `updated="${e.updatedAt}"`,
    `locked="${e.locked}"`,
    `location="${e.location}"`,
    `priority="${e.priority}"`,
  ].join(' ');
  return `<content ${attrs}>\n${e.markup}\n</content>`;
}).join('\n');

export { ADMIN_GLOBAL_FILE, parseEntries, serializeEntries };
