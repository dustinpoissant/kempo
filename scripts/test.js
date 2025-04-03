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
  port = 8084,
  build = true
} = options;

const app = express();

app.use('/kempo', express.static('src'));
app.use('/icons', express.static('icons'));
app.use(express.static('test'));

app.listen(port, () => {
  console.log(`Docs Running on: http://localhost:${port}`);
});