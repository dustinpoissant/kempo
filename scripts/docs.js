import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from '../src/utils/Server.js';
import { getArgs, runChildNodeProcess } from '../src/utils/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const options = getArgs({
  p: 'port',
  b: 'build',
  s: 'src'
});

const {
  port = 8083,
  build = true,
  src = false
} = options;

if(build){
  runChildNodeProcess(join(__dirname, 'build.js'));
}

const server = new Server();

if (src) {
  server
    .get('/', join(__dirname, '../docs/'))
    .get('/kempo/kempo-styles.css', join(__dirname, '../src/kempo-styles.css'))
    .get('/kempo/*', join(__dirname, '../src/*'))
    .get('/icons/*', join(__dirname, '../icons/*'))
    .get('/*', join(__dirname, '../docs/*'));
} else {
  server
    .get('/', join(__dirname, '../docs/'))
    .get('/kempo/kempo-styles.css', join(__dirname, '../docs/kempo/kempo-styles.css'))
    .get('/*', join(__dirname, '../docs/*'));
}

try {
  await server.listen(port);
  console.log(`Docs Running on: http://localhost:${port}`);
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}