import { spawnSync } from 'node:child_process';

const exportResult = spawnSync('npm', ['run', 'export:openapi'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (exportResult.status !== 0) {
  process.exit(exportResult.status ?? 1);
}

const generateResult = spawnSync('npx', ['@hey-api/openapi-ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (generateResult.status !== 0) {
  process.exit(generateResult.status ?? 1);
}
