import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cli from '../kempo/utils/cli.js';

const {
 port = 8084
} = cli();

const app = express();

app.use(express.static('test'));
app.use('/kempo', express.static('kempo'));
app.get('/api/tests', async (_, res) => {
  const tests = {};
  const categories = await fs.readdir('./test/tests/');
  for(let i = 0; i < categories.length; i++){
    tests[categories[i]] = (await fs.readdir(`./test/tests/${categories[i]}/`)).map( t => t.slice(0, t.length - 8));
  }
  res.json(tests);
});

app.listen(port, () => {
  console.log(`Tests Running on: http://localhost:${port}`);
});