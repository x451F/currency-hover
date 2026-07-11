import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const TARGETS = ['chrome', 'firefox'];
const requestedTarget = process.argv[2] ?? 'chrome';

if (requestedTarget !== 'all' && !TARGETS.includes(requestedTarget)) {
  console.error(`Unknown build target "${requestedTarget}". Use chrome, firefox, or all.`);
  process.exit(1);
}

const targets = requestedTarget === 'all' ? TARGETS : [requestedTarget];

for (const target of targets) {
  await buildTarget(target);
}

async function buildTarget(target) {
  const outDir = resolve(`dist/${target}`);
  const env = {
    ...process.env,
    EXTENSION_OUT_DIR: outDir
  };

  await rm(outDir, { recursive: true, force: true });
  await run('pnpm', ['exec', 'vite', 'build'], env);
  await run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.background.config.ts'], env);
  await run('pnpm', ['exec', 'vite', 'build', '--config', 'vite.content.config.ts'], env);
  await mkdir(outDir, { recursive: true });
  await rm(resolve(outDir, '.DS_Store'), { force: true });
  await copyFile(resolve(`manifests/${target}.json`), resolve(outDir, 'manifest.json'));
  if (process.platform === 'darwin') {
    await run('xattr', ['-cr', outDir], env);
  }
}

function run(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      env,
      stdio: 'inherit'
    });

    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}
