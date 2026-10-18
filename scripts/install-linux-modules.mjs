#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { access, cp, lstat, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TARGET = '/opt/frieren/frieren-back/modules';
const DEFAULT_FRONTEND_SRC = path.resolve(REPO_ROOT, '../frieren/frieren-front/src');

const parseArgs = (args) => {
  const options = {
    targetDir: process.env.FRIEREN_MODULES_DIR || DEFAULT_TARGET,
    frontendSrc: process.env.FRIEREN_FRONTEND_SRC || DEFAULT_FRONTEND_SRC,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--target-dir' || arg === '--frontend-src') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a path`);
      }
      options[arg === '--target-dir' ? 'targetDir' : 'frontendSrc'] = path.resolve(value);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/install-linux-modules.mjs [options]

Builds and deploys every non-system module whose manifest lists Linux.

Options:
  --target-dir <path>    Frieren modules directory
                         (default: ${DEFAULT_TARGET})
  --frontend-src <path>  Frieren frontend src directory used by the build
                         (default: ${DEFAULT_FRONTEND_SRC})
  --dry-run              List matching modules without building or deploying
  -h, --help             Show this help

Environment:
  FRIEREN_MODULES_DIR    Override the default target directory
  FRIEREN_FRONTEND_SRC   Override the default frontend source directory`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.targetDir = path.resolve(options.targetDir);
  options.frontendSrc = path.resolve(options.frontendSrc);
  return options;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw new Error(`Unable to run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
};

const isDirectory = async (directory) => {
  try {
    return (await stat(directory)).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const isFile = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const isSymbolicLink = async (filePath) => {
  try {
    return (await lstat(filePath)).isSymbolicLink();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

const findLinuxModules = async () => {
  const entries = await readdir(REPO_ROOT, { withFileTypes: true });
  const modules = [];

  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const moduleDir = path.join(REPO_ROOT, entry.name);
    const manifestPath = path.join(moduleDir, 'public', 'manifest.json');
    if (!(await isFile(manifestPath))) continue;

    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to read ${path.relative(REPO_ROOT, manifestPath)}: ${error.message}`);
    }

    if (manifest.system !== false || !Array.isArray(manifest.guestType) || !manifest.guestType.includes('Linux')) {
      continue;
    }
    if (manifest.name !== entry.name || !/^[a-z0-9_]+$/.test(manifest.name)) {
      throw new Error(`Module directory and manifest name do not match: ${entry.name}`);
    }

    modules.push({ name: manifest.name, directory: moduleDir });
  }

  if (modules.length === 0) {
    throw new Error('No non-system modules declaring Linux support were found.');
  }
  return modules;
};

const validateTarget = async (targetDir) => {
  if (!(await isDirectory(targetDir))) {
    throw new Error(`Frieren modules directory does not exist: ${targetDir}`);
  }
  const coreModulesDir = path.join(targetDir, 'modules');
  if (await isSymbolicLink(targetDir) || !(await isDirectory(coreModulesDir)) || await isSymbolicLink(coreModulesDir)) {
    throw new Error(`Target does not look like Frieren's modules directory: ${targetDir}`);
  }
  if (!(await isFile(path.join(coreModulesDir, 'manifest.json'))) || await isSymbolicLink(path.join(coreModulesDir, 'manifest.json'))) {
    throw new Error(`Target is missing Frieren's core modules manifest: ${targetDir}/modules/manifest.json`);
  }
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const modules = await findLinuxModules();

  console.log(`Linux-compatible modules (${modules.length}):`);
  modules.forEach(({ name }) => console.log(`  - ${name}`));
  console.log(`Target: ${options.targetDir}`);

  if (options.dryRun) return;

  if (Number(process.versions.node.split('.')[0]) < 22) {
    throw new Error('Node.js 22 or newer is required.');
  }
  if (!(await isDirectory(options.frontendSrc))) {
    throw new Error(
      `Frieren frontend sources not found: ${options.frontendSrc}\n`
      + 'Use --frontend-src or set FRIEREN_FRONTEND_SRC to its src directory.'
    );
  }
  await validateTarget(options.targetDir);

  let useSudo = false;
  try {
    await access(options.targetDir, constants.W_OK);
  } catch (error) {
    if (error.code !== 'EACCES') throw error;
    useSudo = true;
  }
  if (useSudo) run('sudo', ['-v']);

  for (const { name, directory } of modules) {
    console.log(`\nBuilding ${name}...`);
    run('corepack', ['yarn', 'install', '--immutable'], { cwd: directory });
    run('corepack', ['yarn', 'build', '--mode', 'production'], {
      cwd: directory,
      env: {
        ...process.env,
        VITE_ANALYZER_ENABLE: 'false',
        VITE_COMMON_ALIAS: options.frontendSrc,
      },
    });

    const distDir = path.join(directory, 'dist');
    if (!(await isDirectory(distDir))) {
      throw new Error(`${name} build did not create ${distDir}`);
    }
    if (!(await isFile(path.join(distDir, 'manifest.json')))) {
      throw new Error(`${name} build did not copy manifest.json into dist/`);
    }
    if (!(await isFile(path.join(distDir, 'module.umd.js')))) {
      throw new Error(`${name} build did not produce dist/module.umd.js; direct installs require the uncompressed bundle`);
    }
    const controllerName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Controller.php`;
    if (!(await isFile(path.join(distDir, controllerName)))) {
      throw new Error(`${name} build did not copy public/${controllerName} into dist/`);
    }
  }

  for (const { name, directory } of modules) {
    const distDir = path.join(directory, 'dist');
    const destination = path.join(options.targetDir, name);
    console.log(`Deploying ${name} to ${destination}...`);
    if (await isSymbolicLink(destination)) {
      throw new Error(`Refusing to deploy through a symbolic link: ${destination}`);
    }

    if (useSudo) {
      run('sudo', ['install', '-d', destination]);
      run('sudo', ['cp', '-R', `${distDir}/.`, `${destination}/`]);
    } else {
      await mkdir(destination, { recursive: true });
      await cp(distDir, destination, { recursive: true, force: true });
    }
  }

  console.log(`\nDeployed ${modules.length} Linux-compatible modules.`);
  console.log('Restart or refresh the Frieren panel to discover them.');
};

main().catch((error) => {
  console.error(`\nModule installation failed: ${error.message}`);
  process.exitCode = 1;
});
