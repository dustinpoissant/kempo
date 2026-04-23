#!/usr/bin/env node

import { existsSync, cpSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { join, dirname, basename } from 'path';
import { execSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import inquirer from 'inquirer';

const args = process.argv.slice(2);
const command = args[0];
const useDefaults = args.includes('-y') || args.includes('--yes');

if(command !== 'init'){
  console.log('Usage: npx kempo init [-y|--yes]');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const moduleRoot = join(__dirname, '..');
const projectDir = process.cwd();
const projectName = basename(projectDir);

/*
  package.json
*/

/*
  Helpers
*/

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  return Array.from(
    { length: 16 },
    () => chars[crypto.randomInt(chars.length)]
  ).join('');
};

const isDockerRunning = () => {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const getPostgresContainers = () => {
  try {
    const output = execSync(
      'docker ps -a --filter "ancestor=postgres" --format "{{.Names}}\\t{{.Status}}"',
      { encoding: 'utf8' }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [name, ...statusParts] = line.split('\t');
      return { name, running: statusParts.join('').startsWith('Up') };
    });
  } catch {
    return [];
  }
};

const waitForPostgres = async (containerName) => {
  process.stdout.write('Waiting for Postgres to be ready');
  for(let i = 0; i < 30; i++){
    try {
      execSync(`docker exec ${containerName} pg_isready -U kempo -d kempo`, { stdio: 'ignore' });
      process.stdout.write(' ready!\n');
      return;
    } catch {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Postgres did not become ready within 30 seconds.');
};

const printManualSteps = (databaseUrl) => {
  console.log('\nComplete setup manually:\n');
  console.log('  docker compose up -d');
  console.log('  npx drizzle-kit push');
  console.log('  node node_modules/kempo/scripts/init-db.js');
  console.log(`  DATABASE_URL="${databaseUrl}" node node_modules/kempo/scripts/make-admin.js`);
  console.log('  npm run dev\n');
};

/*
  Step 1: Existing setup detection
*/

if(existsSync(join(projectDir, 'public'))){
  if(useDefaults){
    console.log('Existing Kempo setup detected. Run `npx kempo upgrade` to update an existing project.');
    process.exit(0);
  }

  const { action } = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'An existing Kempo project was detected. What would you like to do?',
    choices: [
      { name: 'Start over (delete and reinitialize)', value: 'reinit' },
      { name: 'Upgrade instead (npx kempo upgrade)', value: 'upgrade' },
      { name: 'Cancel', value: 'cancel' }
    ]
  }]);

  if(action === 'cancel') process.exit(0);

  if(action === 'upgrade'){
    console.log('\nRun: npx kempo upgrade');
    process.exit(0);
  }

  const { confirm } = await inquirer.prompt([{
    type: 'confirm',
    name: 'confirm',
    message: 'This will delete public/, server/, templates/, extensions/, .env, drizzle.config.js, and docker-compose.yml. Are you sure?',
    default: false
  }]);

  if(!confirm) process.exit(0);

  for(const item of ['public', 'server', 'templates', 'extensions', '.env', 'docker-compose.yml', 'drizzle.config.js']){
    const p = join(projectDir, item);
    if(existsSync(p)) rmSync(p, { recursive: true, force: true });
  }
  console.log('Cleared existing project files.\n');
}

/*
  Step 2: Collect all configuration upfront
*/

console.log('Welcome to Kempo! Let\'s set up your project.\n');

if(!isDockerRunning()){
  const dockerUrls = {
    darwin: 'https://docs.docker.com/desktop/install/mac-install/',
    win32: 'https://docs.docker.com/desktop/install/windows-install/',
    linux: 'https://docs.docker.com/desktop/install/linux-install/'
  };
  console.log('Docker Desktop is required for the PostgreSQL database.');
  console.log(`Install it from: ${dockerUrls[process.platform] || 'https://docs.docker.com/desktop/'}`);
  console.log('Start Docker Desktop, then re-run: npx kempo init\n');
  process.exit(0);
}

const existingContainers = getPostgresContainers();
let containerMode = 'new';
let containerName = 'kempo-postgres';
let customDatabaseUrl = null;

if(existingContainers.length > 0 && !useDefaults){
  const { containerChoice } = await inquirer.prompt([{
    type: 'list',
    name: 'containerChoice',
    message: 'Found existing PostgreSQL containers. Select one or create new:',
    choices: [
      ...existingContainers.map(c => ({
        name: `${c.running ? '(running)' : '(stopped)'}  ${c.name}`,
        value: c.name
      })),
      { name: 'Create a new container', value: '__new__' }
    ]
  }]);

  if(containerChoice !== '__new__'){
    containerMode = 'existing';
    containerName = containerChoice;
    const { existingDbUrl } = await inquirer.prompt([{
      type: 'input',
      name: 'existingDbUrl',
      message: 'Enter the DATABASE_URL for this container:',
      default: 'postgresql://kempo:kempo_dev_password@localhost:5433/kempo'
    }]);
    customDatabaseUrl = existingDbUrl;
  }
}

if(containerMode === 'new' && !useDefaults){
  const { name } = await inquirer.prompt([{
    type: 'input',
    name: 'name',
    message: 'Container name:',
    default: 'kempo-postgres'
  }]);
  containerName = name;
}

const databaseUrl = customDatabaseUrl || `postgresql://kempo:kempo_dev_password@localhost:5433/kempo`;

const generatedAdminPassword = generatePassword();
let adminName, adminEmail, adminPassword;

if(useDefaults){
  adminName = 'Admin';
  adminEmail = 'admin@example.com';
  adminPassword = generatedAdminPassword;
} else {
  const adminAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'adminName',
      message: 'Admin user full name:',
      default: 'Admin'
    },
    {
      type: 'input',
      name: 'adminEmail',
      message: 'Admin user email:',
      default: 'admin@example.com',
      validate: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Please enter a valid email address'
    },
    {
      type: 'password',
      name: 'adminPassword',
      message: 'Admin user password (leave blank to generate one):',
      mask: '*'
    }
  ]);
  adminName = adminAnswers.adminName;
  adminEmail = adminAnswers.adminEmail;
  adminPassword = adminAnswers.adminPassword || generatedAdminPassword;
}

let emailApiKey = '';
let emailFrom = 'noreply@example.com';
let emailServiceSkipped = false;

if(!useDefaults){
  const { emailService } = await inquirer.prompt([{
    type: 'list',
    name: 'emailService',
    message: 'Email service:',
    choices: [
      { name: 'Resend (recommended — https://resend.com)', value: 'resend' },
      { name: 'Skip for now', value: 'skip' }
    ]
  }]);

  if(emailService === 'resend'){
    const emailAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: 'Resend API key:'
      },
      {
        type: 'input',
        name: 'fromEmail',
        message: 'From email address:',
        default: 'noreply@example.com'
      }
    ]);
    emailApiKey = emailAnswers.apiKey;
    emailFrom = emailAnswers.fromEmail;
  } else {
    emailServiceSkipped = true;
  }
}

/*
  Step 3: Scaffold project files
*/

console.log('\n--- Scaffolding project files ---\n');

const pkgPath = join(projectDir, 'package.json');
if(!existsSync(pkgPath)){
  writeFileSync(pkgPath, JSON.stringify({
    name: projectName,
    version: '1.0.0',
    type: 'module',
    private: true,
    scripts: {
      dev: 'kempo-server --root public',
      start: 'kempo-server --root public'
    }
  }, null, 2) + '\n');
  console.log('Created package.json');
}

const gitignorePath = join(projectDir, '.gitignore');
if(!existsSync(gitignorePath)){
  writeFileSync(gitignorePath, 'node_modules\n.env\n');
  console.log('Created .gitignore');
}

const scaffoldSource = join(moduleRoot, 'app-public');
const publicDir = join(projectDir, 'public');
if(!existsSync(publicDir) && existsSync(scaffoldSource)){
  cpSync(scaffoldSource, publicDir, { recursive: true });
  console.log('Scaffolded public/');
}

const appServerDbDir = join(projectDir, 'server', 'db');
const appSchemaPath = join(appServerDbDir, 'schema.js');
const scaffoldSchema = join(moduleRoot, 'app-server', 'db', 'schema.js');
if(!existsSync(appSchemaPath) && existsSync(scaffoldSchema)){
  mkdirSync(appServerDbDir, { recursive: true });
  cpSync(scaffoldSchema, appSchemaPath);
  console.log('Scaffolded server/db/schema.js');
}

const templatesDir = join(projectDir, 'templates');
const templatesSource = join(moduleRoot, 'app-templates');
if(!existsSync(templatesDir) && existsSync(templatesSource)){
  cpSync(templatesSource, templatesDir, { recursive: true });
  console.log('Scaffolded templates/');
}

const extensionsDir = join(projectDir, 'extensions');
if(!existsSync(extensionsDir)){
  mkdirSync(extensionsDir);
  console.log('Created extensions/');
}

const drizzleConfigPath = join(projectDir, 'drizzle.config.js');
const scaffoldDrizzle = join(moduleRoot, 'app-drizzle.config.js');
if(!existsSync(drizzleConfigPath) && existsSync(scaffoldDrizzle)){
  cpSync(scaffoldDrizzle, drizzleConfigPath);
  console.log('Scaffolded drizzle.config.js');
}

/*
  Step 4: Generate docker-compose.yml and .env
*/

if(containerMode === 'new'){
  const dockerComposePath = join(projectDir, 'docker-compose.yml');
  if(!existsSync(dockerComposePath)){
    writeFileSync(dockerComposePath,
`services:
  postgres:
    container_name: ${containerName}
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
`
    );
    console.log('Created docker-compose.yml');
  }
}

writeFileSync(join(projectDir, '.env'),
`# Database
DATABASE_URL=${databaseUrl}

# Email${emailServiceSkipped ? '\n# Configure your email service — update the values below' : ''}
RESEND_API_KEY=${emailApiKey || 'your_resend_api_key_here'}
EMAIL_FROM=${emailFrom}

# Server
PORT=9876
NODE_ENV=development
`
);
console.log('Created .env');

/*
  Step 5: Install dependencies
*/

console.log('\n--- Installing dependencies ---\n');
execSync('npm install kempo', { cwd: projectDir, stdio: 'inherit' });

/*
  Step 6: Start Postgres container
*/

console.log('\n--- Starting database ---\n');

if(containerMode === 'new'){
  const compose = spawnSync('docker', ['compose', 'up', '-d'], {
    cwd: projectDir,
    stdio: 'inherit',
    shell: true
  });
  if(compose.status !== 0){
    console.error('\nFailed to start Docker container. Ensure Docker Desktop is running and try again.');
    printManualSteps(databaseUrl);
    process.exit(1);
  }
  await waitForPostgres(containerName);
} else {
  const container = existingContainers.find(c => c.name === containerName);
  if(container && !container.running){
    execSync(`docker start ${containerName}`, { stdio: 'inherit' });
    await waitForPostgres(containerName);
  }
}

/*
  Step 7: Push schema and seed database
*/

console.log('\n--- Initializing database ---\n');
execSync('npx drizzle-kit push', { cwd: projectDir, stdio: 'inherit' });
execSync('node node_modules/kempo/scripts/init-db.js', { cwd: projectDir, stdio: 'inherit' });

/*
  Step 8: Create admin user
*/

console.log('\n--- Creating admin user ---\n');

process.env.DATABASE_URL = databaseUrl;

const { default: createUser } = await import(pathToFileURL(join(moduleRoot, 'server', 'utils', 'users', 'createUser.js')).href);
const { default: addUserToGroup } = await import(pathToFileURL(join(moduleRoot, 'server', 'utils', 'groups', 'addUserToGroup.js')).href);

const [createError, createdUser] = await createUser({
  name: adminName,
  email: adminEmail,
  password: adminPassword,
  emailVerified: true
});

if(createError){
  console.error(`Failed to create admin user: ${createError.msg}`);
} else {
  const [groupError] = await addUserToGroup(createdUser.user.id, 'system:Administrators');
  if(groupError){
    console.error(`Failed to assign admin role: ${groupError.msg}`);
  } else {
    console.log(`Admin user created: ${adminEmail}`);
  }
}

/*
  Summary
*/

console.log(`
╔══════════════════════════════════════════╗
║        Kempo setup complete!             ║
╚══════════════════════════════════════════╝

Admin credentials:
  Email:    ${adminEmail}
  Password: ${adminPassword}
${emailServiceSkipped ? '\n  Note: Email is not configured. Update RESEND_API_KEY in .env when ready.\n' : ''}
Next steps:
  npm run dev

Then open:
  http://localhost:9876        (your site)
  http://localhost:9876/admin  (admin panel)
`);
