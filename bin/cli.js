#!/usr/bin/env node

import { existsSync, cpSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname, basename } from 'path';
import { execSync, spawnSync } from 'child_process';
import { createInterface } from 'readline';

const args = process.argv.slice(2);
const command = args[0];

if(command !== 'init'){
  console.log('Usage: npx kempo init');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = question => new Promise(resolve => rl.question(question, resolve));
const ask = async question => {
  const answer = await prompt(`${question} [y/N] `);
  return answer.trim().toLowerCase() === 'y';
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const moduleRoot = join(__dirname, '..');
const projectDir = process.cwd();
const projectName = basename(projectDir);

/*
  package.json
*/

const pkgPath = join(projectDir, 'package.json');
if(!existsSync(pkgPath)){
  writeFileSync(pkgPath, JSON.stringify({
    name: projectName,
    version: '1.0.0',
    type: 'module',
    private: true,
    scripts: {
      start: 'kempo-server --root public',
    },
  }, null, 2) + '\n');
  console.log('Created package.json');
}

/*
  .env
*/

const envPath = join(projectDir, '.env');
if(!existsSync(envPath)){
  writeFileSync(envPath, `DATABASE_URL=postgres://kempo:kempo_dev_password@localhost:5433/kempo
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
`);
  console.log('Created .env');
}

/*
  .gitignore
*/

const gitignorePath = join(projectDir, '.gitignore');
if(!existsSync(gitignorePath)){
  writeFileSync(gitignorePath, `node_modules
.env
`);
  console.log('Created .gitignore');
}

/*
  Install kempo
*/

console.log('\nInstalling kempo...\n');
execSync('npm install kempo --ignore-scripts', { cwd: projectDir, stdio: 'inherit' });

/*
  Scaffold public/ from app-public/
*/

const publicDir = join(projectDir, 'public');
const scaffoldSource = join(moduleRoot, 'app-public');
if(!existsSync(publicDir) && existsSync(scaffoldSource)){
  cpSync(scaffoldSource, publicDir, { recursive: true });
  console.log('\n[kempo] Scaffolded public/ directory');
}

/*
  Scaffold server/db/schema.js
*/

const appServerDbDir = join(projectDir, 'server', 'db');
const appSchemaPath = join(appServerDbDir, 'schema.js');
const scaffoldSchema = join(moduleRoot, 'app-server', 'db', 'schema.js');
if(!existsSync(appSchemaPath) && existsSync(scaffoldSchema)){
  mkdirSync(appServerDbDir, { recursive: true });
  cpSync(scaffoldSchema, appSchemaPath);
  console.log('[kempo] Scaffolded server/db/schema.js');
}

/*
  Scaffold templates/ from app-templates/
*/

const templatesDir = join(projectDir, 'templates');
const templatesSource = join(moduleRoot, 'app-templates');
if(!existsSync(templatesDir) && existsSync(templatesSource)){
  cpSync(templatesSource, templatesDir, { recursive: true });
  console.log('[kempo] Scaffolded templates/ directory');
}

/*
  Create extensions/ directory
*/

const extensionsDir = join(projectDir, 'extensions');
if(!existsSync(extensionsDir)){
  mkdirSync(extensionsDir);
  console.log('[kempo] Created extensions/ directory');
}

/*
  Scaffold drizzle.config.js
*/

const drizzleConfigPath = join(projectDir, 'drizzle.config.js');
const scaffoldDrizzle = join(moduleRoot, 'app-drizzle.config.js');
if(!existsSync(drizzleConfigPath) && existsSync(scaffoldDrizzle)){
  cpSync(scaffoldDrizzle, drizzleConfigPath);
  console.log('[kempo] Scaffolded drizzle.config.js');
}

/*
  Scaffold docker-compose.yml
*/

const dockerComposePath = join(projectDir, 'docker-compose.yml');
if(!existsSync(dockerComposePath)){
  writeFileSync(dockerComposePath, `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: kempo
      POSTGRES_PASSWORD: kempo_dev_password
      POSTGRES_DB: kempo
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
`);
  console.log('[kempo] Scaffolded docker-compose.yml');
}

/*
  Database setup
*/

console.log('\nNext, kempo needs a PostgreSQL database via Docker.');
console.log('Please make sure Docker Desktop is installed and running before continuing.\n');

const setupDb = await ask('Would you like me to start the database and run the initial setup?');
if(setupDb){
  console.log('\nStarting database...');
  const compose = spawnSync('docker', ['compose', 'up', '-d'], { cwd: projectDir, stdio: 'inherit', shell: true });
  if(compose.status !== 0){
    console.error('\nFailed to start Docker. Make sure Docker Desktop is running and try again.');
    console.log('\nYou can complete setup manually:\n');
    console.log('  docker compose up -d');
    console.log('  npx drizzle-kit push');
    console.log('  node node_modules/kempo/scripts/init-db.js');
    console.log('  npm start\n');
    rl.close();
    process.exit(1);
  }

  console.log('\nPushing database schema...');
  execSync('npx drizzle-kit push', { cwd: projectDir, stdio: 'inherit' });

  console.log('\nInitialising database...');
  execSync('node node_modules/kempo/scripts/init-db.js', { cwd: projectDir, stdio: 'inherit' });

  console.log('\nDone! Run npm start to launch your app.\n');
} else {
  console.log(`
Done! To complete setup:

  docker compose up -d
  npx drizzle-kit push
  node node_modules/kempo/scripts/init-db.js
  npm start
`);
}

rl.close();
