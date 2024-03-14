import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import cli from '../kempo/utils/cli.js';

const {
 port = 8083
} = cli();

const app = express();

app.use(express.static('docs'));
app.use('/kempo', express.static('kempo'));

app.listen(port, () => {
  console.log(`Docs Running on: http://localhost:${port}`);
});