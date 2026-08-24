import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/*
  Thin wrapper around `kempo-test -b` that brackets the run with the vendor junctions browser tests
  need (see link-browser-test-vendors.js) and guarantees they're torn down even if the run fails or
  is interrupted — a stray junction at the project root would otherwise confuse git status, the
  build, and every other test that isn't expecting it.
*/

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const linkScript = join(root, 'scripts', 'link-browser-test-vendors.js');
const runLinker = args => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [linkScript, ...args], { stdio: 'inherit', cwd: root });
  child.on('exit', code => code === 0 ? resolve() : reject(new Error(`link-browser-test-vendors.js exited with ${code}`)));
});

await runLinker([]);

let exitCode = 1;
try {
  exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(root, 'node_modules', 'kempo-testing-framework', 'index.js'), '-b', ...process.argv.slice(2)],
      { stdio: 'inherit', cwd: root }
    );
    child.on('exit', code => resolve(code ?? 1));
    child.on('error', reject);
  });
} finally {
  await runLinker(['--remove']);
}

process.exit(exitCode);
