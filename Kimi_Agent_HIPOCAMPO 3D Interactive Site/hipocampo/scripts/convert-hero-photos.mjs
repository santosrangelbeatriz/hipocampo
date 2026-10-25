// Converte as fotos de ../../fotosparatextoda1imagem para public/images/hero/foto-NN.webp
// (largura máxima 1400px, qualidade 0.8) usando o Chrome/Edge headless já instalado.
// Não apaga a pasta original. Uso: node scripts/convert-hero-photos.mjs
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = path.resolve(projectRoot, '..', '..', 'fotosparatextoda1imagem')
const outputDir = path.join(projectRoot, 'public', 'images', 'hero')
const MAX_WIDTH = 1400
const QUALITY = 0.8

const SOURCES = [
  'image.png',
  'image copy.png',
  'image copy 2.png',
  'image copy 3.png',
  'image copy 4.png',
  'image copy 5.png',
  'image copy 6.png',
  'image copy 7.png',
  'image copy 8.png',
]

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

async function getWebSocketClass() {
  if (globalThis.WebSocket) return globalThis.WebSocket
  return (await import('ws')).default
}

function launchBrowser(executable, userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ])
    const timer = setTimeout(() => reject(new Error('Navegador não respondeu.')), 20000)
    child.stderr.on('data', (chunk) => {
      const match = chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/)
      if (match) {
        clearTimeout(timer)
        resolve({ child, endpoint: match[1] })
      }
    })
    child.on('error', reject)
  })
}

function connect(WebSocketClass, endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocketClass(endpoint)
    const pending = new Map()
    let nextId = 1

    const onMessage = (raw) => {
      const message = JSON.parse(typeof raw === 'string' ? raw : raw.data ?? raw.toString())
      const request = pending.get(message.id)
      if (!request) return
      pending.delete(message.id)
      if (message.error) request.reject(new Error(message.error.message))
      else request.resolve(message.result)
    }

    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const id = nextId++
      pending.set(id, { resolve: ok, reject: fail })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

    if (socket.addEventListener) {
      socket.addEventListener('message', onMessage)
      socket.addEventListener('open', () => resolve({ socket, send }))
      socket.addEventListener('error', reject)
    } else {
      socket.on('message', onMessage)
      socket.on('open', () => resolve({ socket, send }))
      socket.on('error', reject)
    }
  })
}

const encodeInPage = `async (dataUrl, maxWidth, quality) => {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const context = canvas.getContext('2d')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', quality)
  if (!webp.startsWith('data:image/webp')) throw new Error('Navegador sem encoder WebP')
  return { base64: webp.split(',')[1], width: canvas.width, height: canvas.height }
}`

async function main() {
  const executable = BROWSER_CANDIDATES.find((candidate) => existsSync(candidate))
  if (!executable) throw new Error('Chrome/Edge não encontrado. Defina CHROME_PATH.')

  await mkdir(outputDir, { recursive: true })
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'hipocampo-webp-'))
  const { child, endpoint } = await launchBrowser(executable, userDataDir)

  try {
    const WebSocketClass = await getWebSocketClass()
    const { socket, send } = await connect(WebSocketClass, endpoint)
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

    for (const [index, fileName] of SOURCES.entries()) {
      const sourcePath = path.join(sourceDir, fileName)
      const outputName = `foto-${String(index + 1).padStart(2, '0')}.webp`
      const png = await readFile(sourcePath)
      const dataUrl = `data:image/png;base64,${png.toString('base64')}`
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression: `(${encodeInPage})(${JSON.stringify(dataUrl)}, ${MAX_WIDTH}, ${QUALITY})`,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId)

      if (exceptionDetails) throw new Error(`${fileName}: ${exceptionDetails.text}`)
      const { base64, width, height } = result.value
      const webp = Buffer.from(base64, 'base64')
      await writeFile(path.join(outputDir, outputName), webp)
      console.log(`${fileName} -> ${outputName} (${width}x${height}, ${(webp.length / 1024).toFixed(0)} KB)`)
    }

    socket.close()
  } finally {
    child.kill()
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
