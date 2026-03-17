import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const env = {
  ...process.env,
  PKG_CACHE_PATH: path.join(root, '.pkg-cache'),
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npm', ['run', 'build'])
run('npx', ['pkg', '.', '--targets', 'node16-win-x64', '--output', 'release/TRPG模组笔记.exe'])
