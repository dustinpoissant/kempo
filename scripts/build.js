import fs from 'fs/promises';
import fse from 'fs-extra';
import { minify } from 'terser';

console.log('Loading utils');
const components = (await fs.readdir('./kempo/components/')).map(f=>f.substring(0,f.length-3));
let complete = 0;

console.log('Loading Component Source Code');
process.stdout.write(`0/${components.length} = 0%`);
const componentCode = {};
await Promise.all(components.map( async component => {
  componentCode[component] = await fs.readFile(`./kempo/components/${component}.js`, 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Minifying Component Source Code');
process.stdout.write(`0/${components.length} = 0%`);
const minifiedCompontents = {};
await Promise.all(components.map( async componentFile => {
  minifiedCompontents[componentFile] = (await minify(componentCode[componentFile])).code
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Saving Minified Components to dist/');
process.stdout.write(`0/${components.length} = 0%`);
await Promise.all(components.map( async component => {
  await fs.writeFile(`./dist/components/${component}.js`, minifiedCompontents[component], 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${components.length} = ${Math.round((complete/components.length)*100)}%`);
}));
process.stdout.write("\n");

console.log('Loading Utils');
const utils = (await fs.readdir('./kempo/utils/')).map(f=>f.substring(0,f.length-3));
complete = 0;

console.log('Loading Utils Source Code');
process.stdout.write(`0/${utils.length} = 0%`);
const utilCode = {};
await Promise.all(utils.map( async util => {
  utilCode[util] = await fs.readFile(`./kempo/utils/${util}.js`, 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Minifying Utils Source Code');
process.stdout.write(`0/${utils.length} = 0%`);
const minifiedUtils = {};
await Promise.all(utils.map( async utilFile => {
  minifiedUtils[utilFile] = (await minify(utilCode[utilFile])).code
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length)*100)}%`);
}));
process.stdout.write("\n");

complete = 0;
console.log('Saving Minified Utils to dist/');
process.stdout.write(`0/${utils.length} = 0%`);
await Promise.all(utils.map( async util => {
  await fs.writeFile(`./dist/utils/${util}.js`, minifiedUtils[util], 'utf-8');
  process.stdout.write("\r");
  complete++;
  process.stdout.write(`${complete}/${utils.length} = ${Math.round((complete/utils.length)*100)}%`);
}));
process.stdout.write("\n");

console.log('Generatoring export file');
const main = `
  ${components.map( component => `import ${component} from './components/${component}.js';` ).join('')}
  ${utils.map( util => `import ${util} from './utils/${util}.js';` ).join('')}
  export default {
    ${components.map( component => `${component}`).join(',')},
    ${utils.map( util => `${util}`).join(',')}
  };
`;
const minifiedMain = (await minify(main)).code;
console.log('Saving minified main entry file');
await fs.writeFile('./dist/index.js', minifiedMain, 'utf-8');

console.log('Loading kempo.js');
const kempoJS = await fs.readFile('./kempo/kempo.js', 'utf-8');
console.log('Minifying kempo.js');
const minifiedKempoJs = (await minify(kempoJS)).code;
console.log('Saving minfiied kempo.js');
await fs.writeFile('./dist/kempo.js', minifiedKempoJs, 'utf-8');

console.log('Loading kempo.css');
const kempoCSS = await fs.readFile('./kempo/kempo.css', 'utf-8');
console.log('Minifying kempo.css');
const minifiedKempoCSS = kempoCSS.replace(/\s*\{\s*/g, '{').replace(/\s*\}\s*/g, '}').replace(/\n/g, '').replace(/\r/g, '').replace(/\s+/g, ' ').replace(/\s*\:\s*/g, ':').replace(/\s*\;\s*/g, ';').replace(/;\}/g, '}');
console.log('Saving kempo.css');
await fs.writeFile('./dist/kempo.css', minifiedKempoCSS, 'utf-8');

console.log('Copying dist/ to docs/kempo/');
await fse.copy('./dist', './docs/kempo')

console.log('Copying icons/ to docs/icons/');
await fse.copy('./icons', './docs/icons')

console.log('build complete');