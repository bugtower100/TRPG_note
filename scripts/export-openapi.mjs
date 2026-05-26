import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const serverDir = path.join(root, 'server');
const outputPath = path.join(root, 'openapi', 'v2-phase1-openapi.json');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const result = spawnSync(
  'go',
  ['run', '.', '--export-openapi', '..\\openapi\\v2-phase1-openapi.json'],
  {
    cwd: serverDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!fs.existsSync(outputPath)) {
  console.error(`OpenAPI export not found: ${outputPath}`);
  process.exit(1);
}
