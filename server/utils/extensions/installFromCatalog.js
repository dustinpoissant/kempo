import { existsSync } from 'fs';
import { join } from 'path';
import db from '../../db/index.js';
import { extension } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import installExtension from './installExtension.js';
import installPackage from './installPackage.js';
import { NAME_PATTERN } from './catalogClient.js';

const isInstalled = async name => {
  const [row] = await db.select({ name: extension.name }).from(extension).where(eq(extension.name, name)).limit(1);
  return !!row;
};

const hasPackage = name => existsSync(join(process.cwd(), 'node_modules', name, 'package.json'));

/*
  Installs an extension, and with `withDependencies` every extension it needs first, in dependency
  order, downloading what is not in node_modules. What is installed is exactly the marketplace's tree
  for that extension: the caller is expected to have shown it to the administrator for approval.

  Without `withDependencies` only `name` is installed, and a dependency that is not installed yet is
  an error that names them (`needs`), so the caller can ask.

  A package that is already in node_modules is not downloaded again. A failure part way leaves what
  was installed before it installed (each one is a normal, complete install) and says which.

  `deps` exists so the order and the refusals can be tested without npm or a database.
*/
export default async ({ name, withDependencies = false, client, installId, report = true, deps = {} }) => {
  const download = deps.download || installPackage;
  const install = deps.install || installExtension;
  const installed = deps.isInstalled || isInstalled;
  const present = deps.hasPackage || hasPackage;

  if(typeof name !== 'string' || !NAME_PATTERN.test(name)){
    return [{ code: 400, msg: 'Extension name is not a valid package name' }, null];
  }

  if(await installed(name)){
    return [{ code: 409, msg: 'Extension is already installed' }, null];
  }

  const [detailsError, details] = await client.details(name);

  /*
    Without the marketplace an extension that is already in node_modules can still be installed the
    way it always could be; one that has to be downloaded cannot.
  */
  if(detailsError){
    if(!present(name)) return [detailsError, null];
    const [error, data] = await install({ name });
    if(error) return [error, null];
    return [null, { name, installed: [name], ...data }];
  }

  const plan = [...details.dependencies.extensions, { name, version: details.version, installable: details.installable }];

  for(const missing of details.dependencies.unresolved){
    if(!(await installed(missing)) && !present(missing)){
      return [{ code: 409, msg: `Requires ${missing}, which is not in the extension catalogue` }, null];
    }
  }

  if(!withDependencies){
    const needs = [];
    for(const step of plan.slice(0, -1)){
      if(!(await installed(step.name))) needs.push(step.name);
    }
    if(needs.length){
      return [{ code: 409, msg: `Requires ${needs.join(', ')} to be installed first`, needs }, null];
    }
  }

  const done = [];
  let result = {};

  for(const step of withDependencies ? plan : plan.slice(-1)){
    if(await installed(step.name)) continue;

    if(!present(step.name)){
      if(!step.installable){
        return [{ code: 409, msg: `"${step.name}" is listed but not published yet, so it cannot be installed`, installed: done }, null];
      }
      const [downloadError] = await download({ name: step.name, version: step.version || 'latest' });
      if(downloadError) return [{ ...downloadError, installed: done }, null];
    }

    const [installError, data] = await install({ name: step.name });
    if(installError) return [{ ...installError, installed: done }, null];

    done.push(step.name);
    if(step.name === name) result = data;
  }

  /*
    Tell the marketplace, once per extension, after the fact and without making the install wait for
    it: a marketplace that is down must not make an install fail.
  */
  if(report && installId){
    for(const installedName of done){
      client.report({ installId, extension: installedName }).catch(() => {});
    }
  }

  return [null, { name, installed: done, ...result }];
};
