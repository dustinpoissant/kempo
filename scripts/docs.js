import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  getArgs,
  runChildNodeProcess
} from '../src/utils/cli.js';

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

const app = express();

if(src){
  app.use('/kempo', express.static('src'));
  app.use('/icons', express.static('icons'));
  app.get('/kempo/kempo-styles.css', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(join(__dirname, '../src/kempo-styles.css'));
  })
} else {
  app.get('/kempo/kempo-styles.css', (req, res) => {
    res.set('Cache-Control', 'private');
    res.sendFile(join(__dirname, '../docs/kempo/kempo-styles.css'));
  });
}
app.use(express.static('docs'));

app.listen(port, () => {
  console.log(`Docs Running on: http://localhost:${port}`);
});