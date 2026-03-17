import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const args = new Set(process.argv.slice(2))

const normalizeStore = (input) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const result = {}
  Object.entries(input).forEach(([key, value]) => {
    if (!key || typeof key !== 'string') return
    if (typeof value === 'string') {
      result[key] = value
      return
    }
    try {
      result[key] = JSON.stringify(value ?? null)
    } catch {
      result[key] = 'null'
    }
  })
  return result
}

const cleanData = () => {
  const storagePath = path.join(root, 'data', 'storage.json')
  fs.mkdirSync(path.dirname(storagePath), { recursive: true })
  if (!fs.existsSync(storagePath)) {
    fs.writeFileSync(storagePath, JSON.stringify({}, null, 2), 'utf-8')
    return ['created data/storage.json']
  }
  try {
    const raw = fs.readFileSync(storagePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const normalized = normalizeStore(parsed)
    fs.writeFileSync(storagePath, JSON.stringify(normalized, null, 2), 'utf-8')
    return ['normalized data/storage.json']
  } catch {
    const broken = `${storagePath}.broken.${Date.now()}`
    fs.copyFileSync(storagePath, broken)
    fs.writeFileSync(storagePath, JSON.stringify({}, null, 2), 'utf-8')
    return [`backup created: ${path.basename(broken)}`, 'reset data/storage.json']
  }
}

const removeIfExists = (target) => {
  if (!fs.existsSync(target)) return false
  fs.rmSync(target, { recursive: true, force: true })
  return true
}

const cleanCache = () => {
  const targets = [
    '.electron-cache',
    '.electron-cache-2',
    '.electron-cache-3',
    '.electron-builder-cache',
    '.electron-builder-cache-2',
    '.electron-builder-cache-3',
  ].map((p) => path.join(root, p))

  const removed = []
  targets.forEach((target) => {
    if (removeIfExists(target)) removed.push(path.basename(target))
  })
  return removed.length ? removed : ['no electron cache found']
}

if (args.has('--clean-data')) {
  const logs = cleanData()
  logs.forEach((line) => console.log(line))
}

if (args.has('--clean-cache')) {
  const logs = cleanCache()
  logs.forEach((line) => console.log(line))
}

if (!args.has('--clean-data') && !args.has('--clean-cache')) {
  console.log('usage: node scripts/maintenance.mjs --clean-data --clean-cache')
}

