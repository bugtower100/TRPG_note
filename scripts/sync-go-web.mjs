import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const distDir = path.join(root, 'dist')
const dstDir = path.join(root, 'server', 'resource')

if (!fs.existsSync(distDir)) {
  process.exit(0)
}
fs.mkdirSync(dstDir, { recursive: true })

const rmrf = (p) => {
  if (!fs.existsSync(p)) return
  const stat = fs.statSync(p)
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(p)) {
      rmrf(path.join(p, name))
    }
    fs.rmdirSync(p)
  } else {
    fs.unlinkSync(p)
  }
}

rmrf(dstDir)
fs.mkdirSync(dstDir, { recursive: true })

const copy = (src, dst) => {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      copy(path.join(src, name), path.join(dst, name))
    }
  } else {
    fs.copyFileSync(src, dst)
  }
}

copy(distDir, dstDir)
