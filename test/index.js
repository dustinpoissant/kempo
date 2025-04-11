import { Server } from '../src/utils/Server.js';
import fs from 'fs/promises';
import cli from '../src/utils/cli.js';

const {
  port = 8084
} = cli();

const server = new Server();

server
  .static('/', './test')
  .static('/kempo', './kempo')
  .get('/api/tests', async (req, res) => {
    try {
      const tests = {};
      const categories = await fs.readdir('./test/tests/');
      for(let i = 0; i < categories.length; i++){
        tests[categories[i]] = (await fs.readdir(`./test/tests/${categories[i]}/`))
          .map(t => t.slice(0, t.length - 8));
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tests));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

try {
  await server.listen(port);
  console.log(`Tests Running on: http://localhost:${port}`);
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}