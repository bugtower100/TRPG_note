const express = require('express')
const fs = require('fs')
const path = require('path')
const open = require('open')

const isPackaged = Boolean(process.pkg)
const exeDir = path.dirname(process.execPath)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const dataDir = isPackaged ? path.join(exeDir, 'data') : path.join(rootDir, 'data')
const storageFile = path.join(dataDir, 'storage.json')

const ensureWritableDataDir = () => {
  fs.mkdirSync(dataDir, { recursive: true })
  const testPath = path.join(dataDir, '.write-test')
  fs.writeFileSync(testPath, 'ok')
  fs.unlinkSync(testPath)
}

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

const ensureStorage = () => {
  ensureWritableDataDir()
  if (!fs.existsSync(storageFile)) {
    fs.writeFileSync(storageFile, JSON.stringify({}, null, 2), 'utf-8')
    return
  }
  try {
    const raw = fs.readFileSync(storageFile, 'utf-8')
    const parsed = JSON.parse(raw)
    const normalized = normalizeStore(parsed)
    fs.writeFileSync(storageFile, JSON.stringify(normalized, null, 2), 'utf-8')
  } catch {
    const brokenFile = `${storageFile}.broken.${Date.now()}`
    fs.copyFileSync(storageFile, brokenFile)
    fs.writeFileSync(storageFile, JSON.stringify({}, null, 2), 'utf-8')
  }
}

const readStore = () => {
  const raw = fs.readFileSync(storageFile, 'utf-8')
  const parsed = JSON.parse(raw)
  return normalizeStore(parsed)
}

const writeStore = (store) => {
  const normalized = normalizeStore(store)
  fs.writeFileSync(storageFile, JSON.stringify(normalized, null, 2), 'utf-8')
}

const resolveDistDir = () => {
  if (isPackaged) {
    return path.join(__dirname, '..', 'dist')
  }
  return distDir
}

const start = async () => {
  ensureStorage()

  const app = express()
  app.use(express.json({ limit: '10mb' }))

  app.get('/api/storage/health', (_req, res) => {
    res.json({ ok: true, file: storageFile })
  })

  app.get('/api/storage/all', (_req, res) => {
    res.json(readStore())
  })

  app.put('/api/storage/:key', (req, res) => {
    const key = decodeURIComponent(req.params.key)
    const value = typeof req.body?.value === 'string' ? req.body.value : ''
    const store = readStore()
    store[key] = value
    writeStore(store)
    res.json({ ok: true })
  })

  app.delete('/api/storage/:key', (req, res) => {
    const key = decodeURIComponent(req.params.key)
    const store = readStore()
    delete store[key]
    writeStore(store)
    res.json({ ok: true })
  })

  if (!isPackaged) {
    app.get('/__dev', (_req, res) => {
      res.send('server ok')
    })
    app.use((_req, res) => {
      res.redirect('http://127.0.0.1:5174')
    })
  } else {
    const packagedDist = resolveDistDir()
    app.use(express.static(packagedDist))
    app.get('*', (_req, res) => {
      res.sendFile(path.join(packagedDist, 'index.html'))
    })
  }

  const server = app.listen(0, '127.0.0.1', async () => {
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 5174
    const url = isPackaged ? `http://127.0.0.1:${port}` : 'http://127.0.0.1:5174'
    await open(url)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})
