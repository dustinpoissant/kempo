import express from 'express';
import cli from '../kempo/utils/cli.js';

const {
 port = 8083
} = cli();

const app = express();

app.use(express.static('docs'));

app.listen(port, () => {
  console.log(`Docs Running on: http://localhost:${port}`);
});