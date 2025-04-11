import fs from 'fs/promises';
import { minify } from 'terser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ensureDir, copyDir, emptyDir } from '../src/utils/fs-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Loading utils');

const components = [];
async function buildComponents(dir) {
  const files = await fs.readdir(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = await fs.lstat(fullPath);
    if (stat.isDirectory()) {
      await buildComponents(fullPath);
    } else if (file.endsWith('.js')) {
      components.push(fullPath);
    }
  }
}

const componentsDir = path.join(__dirname, '..', 'src', 'components');
await buildComponents(componentsDir);

let complete = 0;

console.log('Loading Component Source Code');
process.stdout.write(`0/${components.length} = 0%`);
const componentCode = {};
await Promise.all(components.map(async component => {
  componentCode[component] = await fs.readFile(component, 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Minifying Component Source Code');
process.stdout.write(`0/${components.length} = 0%`);
const minifiedComponents = {};
await Promise.all(components.map(async componentFile => {
  minifiedComponents[componentFile] = (await minify(componentCode[componentFile])).code;
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Saving Minified Components to dist/');
process.stdout.write(`0/${components.length} = 0%`);
await Promise.all(components.map(async component => {
  const relativePath = path.relative(componentsDir, component);
  const destPath = path.join('./dist/components', relativePath);
  await ensureDir(path.dirname(destPath));
  await fs.writeFile(destPath, minifiedComponents[component], 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

console.log('Loading Utils');
const utils = (await fs.readdir('./src/utils/')).map(f => f.substring(0, f.length - 3));
complete = 0;

console.log('Loading Utils Source Code');
process.stdout.write(`0/${utils.length} = 0%`);
const utilCode = {};
await Promise.all(utils.map(async util => {
  utilCode[util] = await fs.readFile(`./src/utils/${util}.js`, 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length) * 100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Minifying Utils Source Code');
process.stdout.write(`0/${utils.length} = 0%`);
const minifiedUtils = {};
await Promise.all(utils.map(async utilFile => {
  minifiedUtils[utilFile] = (await minify(utilCode[utilFile])).code;
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length) * 100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Saving Minified Utils to dist/');
process.stdout.write(`0/${utils.length} = 0%`);
await ensureDir('./dist/utils');
await Promise.all(utils.map(async util => {
  await fs.writeFile(`./dist/utils/${util}.js`, minifiedUtils[util], 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length) * 100)}%`);
}));
process.stdout.write("\n");

// console.log('Generating export file');
// const main = `
//   ${components.map(component => `import ${path.basename(component, '.js')} from './components/${path.relative(componentsDir, component)}';`).join('')}
//   ${utils.map(util => `import ${util} from './utils/${util}.js';`).join('')}
//   export default {
//     ${components.map(component => `${path.basename(component, '.js')}`).join(',')},
//     ${utils.map(util => `${util}`).join(',')}
//   };
// `;
// const minifiedMain = (await minify(main)).code;
// console.log('Saving minified main entry file');
// await fs.writeFile('./dist/index.js', minifiedMain, 'utf-8');

console.log('Loading kempo-vars.css');
const kempoVarsCSS = await fs.readFile('./src/kempo-vars.css', 'utf-8');
console.log('Minifying kempo-vars.css');
const minifiedKempoVarsCSS = kempoVarsCSS.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}').replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\s*\:\s*/g, ':').replace(/\s*\;\s*/g, ';').replace(/;\}/g, '}');
console.log('Saving kempo-vars.css');
await fs.writeFile('./dist/kempo-vars.css', minifiedKempoVarsCSS, 'utf-8');

console.log('Loading kempo-styles.css');
const kempoStylesCSS = await fs.readFile('./src/kempo-styles.css', 'utf-8');
console.log('Minifying kempo-styles.css');
const minifiedKempoStylesCSS = kempoStylesCSS.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}').replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\s*\:\s*/g, ':').replace(/\s*\;\s*/g, ';').replace(/;\}/g, '}');
console.log('Saving kempo-styles.css');
await fs.writeFile('./dist/kempo-styles.css', minifiedKempoStylesCSS, 'utf-8');

console.log('Loading kempo-hljs.css');
const kempoHljsCSS = await fs.readFile('./src/kempo-hljs.css', 'utf-8');
console.log('Minifying kempo-hljs.css');
const minifiedKempoHljsCSS = kempoHljsCSS.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}').replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\s*\:\s*/g, ':').replace(/\s*\;\s*/g, ';').replace(/;\}/g, '}');
console.log('Saving kempo-hljs.css');
await fs.writeFile('./dist/kempo-hljs.css', minifiedKempoHljsCSS, 'utf-8');

console.log('Copying dist/ to docs/');
await ensureDir('./docs/'); // will also ensure docs/kempo
await copyDir('./dist', './docs/kempo')

const iconsSrcDir = path.join(__dirname, '../icons');
const iconsDestDir = path.join(__dirname, '../docs/icons');

console.log('Deleting svg icons currently in docs/icons');
await ensureDir(iconsDestDir);
await emptyDir(iconsDestDir);
console.log('Copying all files from icons to docs/icons');
await copyDir(iconsSrcDir, iconsDestDir);

console.log('Build Complete');