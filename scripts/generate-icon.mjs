import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = process.cwd()
const svgPath = path.join(root, 'public', 'favicon.svg')
const buildDir = path.join(root, 'build')
const pngPath = path.join(buildDir, 'icon-256.png')
const icoPath = path.join(buildDir, 'icon.ico')

fs.mkdirSync(buildDir, { recursive: true })

await sharp(svgPath)
  .resize(256, 256, { fit: 'contain' })
  .png()
  .toFile(pngPath)

const ico = await pngToIco([pngPath])
fs.writeFileSync(icoPath, ico)
