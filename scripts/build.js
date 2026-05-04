#!/usr/bin/env node

import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'fs';
import { join, dirname, extname, relative } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';
import { minify as terserMinify } from 'terser';
import { minify as htmlMinify } from 'html-minifier-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');

/*
  Stats tracking
*/

const stats = {
  js: { count: 0, originalBytes: 0, minifiedBytes: 0 },
  html: { count: 0, originalBytes: 0, minifiedBytes: 0 },
  json: { count: 0, originalBytes: 0, minifiedBytes: 0 },
  copied: { count: 0, bytes: 0 }
};

const startTime = Date.now();

/*
  File walkers
*/

const walkDir = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for(const entry of entries){
    const fullPath = join(dir, entry.name);
    if(entry.isDirectory()){
      files.push(...await walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

/*
  Processors
*/

const processJs = async (src, dest) => {
  const content = readFileSync(src, 'utf8');
  const originalSize = Buffer.byteLength(content);
  const relativeSrc = relative(root, src);

  const result = await terserMinify(content, {
    sourceMap: {
      filename: relativeSrc,
      url: `${dest.split('/').pop()}.map`,
      includeSources: true
    },
    format: { comments: false },
    module: true,
    compress: true,
    mangle: true
  });

  if(result.code === undefined){
    throw new Error(`Terser returned no output for ${relativeSrc}`);
  }

  writeFileSync(dest, result.code);
  if(result.map){
    writeFileSync(`${dest}.map`, result.map);
  }

  const minifiedSize = Buffer.byteLength(result.code);
  stats.js.count++;
  stats.js.originalBytes += originalSize;
  stats.js.minifiedBytes += minifiedSize;
};

const processHtml = async (src, dest) => {
  const content = readFileSync(src, 'utf8');
  const originalSize = Buffer.byteLength(content);

  // Extract and preserve leading front matter comment block(s)
  let remaining = content;
  let frontMatter = '';
  const frontMatterPattern = /^(<!--[\s\S]*?-->)\s*/;
  let match = remaining.match(frontMatterPattern);
  while(match){
    frontMatter += match[1] + '\n';
    remaining = remaining.slice(match[0].length);
    match = remaining.match(frontMatterPattern);
  }

  const minifiedBody = await htmlMinify(remaining, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: false,
    removeEmptyElements: false,
    minifyJS: false,
    minifyCSS: false,
    keepClosingSlash: true
  });

  const output = frontMatter + minifiedBody;
  writeFileSync(dest, output);

  const minifiedSize = Buffer.byteLength(output);
  stats.html.count++;
  stats.html.originalBytes += originalSize;
  stats.html.minifiedBytes += minifiedSize;
};

const processJson = (src, dest) => {
  const content = readFileSync(src, 'utf8');
  const originalSize = Buffer.byteLength(content);
  const minified = JSON.stringify(JSON.parse(content));
  writeFileSync(dest, minified);
  const minifiedSize = Buffer.byteLength(minified);
  stats.json.count++;
  stats.json.originalBytes += originalSize;
  stats.json.minifiedBytes += minifiedSize;
};

const copyFile = (src, dest) => {
  const size = statSync(src).size;
  copyFileSync(src, dest);
  stats.copied.count++;
  stats.copied.bytes += size;
};

/*
  Main build
*/

const formatBytes = (bytes) => {
  if(bytes < 1024) return `${bytes}B`;
  if(bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

const pct = (original, minified) => {
  if(original === 0) return '0%';
  return `${Math.round((1 - minified / original) * 100)}%`;
};

console.log('Building src/ → dist/\n');

// Clean dist/
if(existsSync(distDir)){
  rmSync(distDir, { recursive: true, force: true });
  console.log('Cleaned dist/\n');
}

// Walk src and process each file
const files = await walkDir(srcDir);
const errors = [];

for(const srcFile of files){
  const relPath = relative(srcDir, srcFile);
  const destFile = join(distDir, relPath);

  mkdirSync(dirname(destFile), { recursive: true });

  const ext = extname(srcFile).toLowerCase();

  try {
    if(ext === '.js'){
      await processJs(srcFile, destFile);
    } else if(ext === '.html' && !relPath.startsWith('admin')){
      await processHtml(srcFile, destFile);
    } else if(ext === '.json'){
      processJson(srcFile, destFile);
    } else {
      copyFile(srcFile, destFile);
    }
    process.stdout.write('.');
  } catch(err){
    errors.push({ file: relPath, message: err.message });
    process.stdout.write('E');
  }
}

process.stdout.write('\n\n');

// Summary
const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('--- Build Summary ---\n');
console.log(`  JS    ${stats.js.count} files   ${formatBytes(stats.js.originalBytes)} → ${formatBytes(stats.js.minifiedBytes)} (${pct(stats.js.originalBytes, stats.js.minifiedBytes)} reduction)`);
console.log(`  HTML  ${stats.html.count} files   ${formatBytes(stats.html.originalBytes)} → ${formatBytes(stats.html.minifiedBytes)} (${pct(stats.html.originalBytes, stats.html.minifiedBytes)} reduction)`);
console.log(`  JSON  ${stats.json.count} files   ${formatBytes(stats.json.originalBytes)} → ${formatBytes(stats.json.minifiedBytes)} (${pct(stats.json.originalBytes, stats.json.minifiedBytes)} reduction)`);
console.log(`  Copy  ${stats.copied.count} files   ${formatBytes(stats.copied.bytes)}`);

const totalOriginal = stats.js.originalBytes + stats.html.originalBytes + stats.json.originalBytes;
const totalMinified = stats.js.minifiedBytes + stats.html.minifiedBytes + stats.json.minifiedBytes;
console.log(`\n  Total ${formatBytes(totalOriginal)} → ${formatBytes(totalMinified + stats.copied.bytes)} (${pct(totalOriginal, totalMinified)} minification reduction)`);
console.log(`  Time  ${elapsed}s`);

if(errors.length > 0){
  console.error(`\n--- Errors (${errors.length}) ---\n`);
  for(const { file, message } of errors){
    console.error(`  ${file}\n    ${message}\n`);
  }
  process.exit(1);
}

console.log('\nBuild complete.\n');
