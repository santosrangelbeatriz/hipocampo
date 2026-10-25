import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = path.join(projectRoot, 'artifacts', 'performance-comparison', 'depois')
await mkdir(outputDir, { recursive: true })

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

if (!browserPath) {
  throw new Error('Chrome/Edge não encontrado.')
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function launchBrowser(userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(browserPath, [
      '--headless=new',
      '--enable-gpu-rasterization',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], { windowsHide: true })

    const timer = setTimeout(() => reject(new Error('Timeout ao abrir navegador.')), 20000)
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

function connect(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint)
    const pending = new Map()
    let nextId = 1

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (message.id) {
        const req = pending.get(message.id)
        if (!req) return
        pending.delete(message.id)
        if (message.error) req.reject(new Error(message.error.message))
        else req.resolve(message.result)
      }
    })

    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const id = nextId++
      pending.set(id, { resolve: ok, reject: fail })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

    socket.on('open', () => resolve({ socket, send }))
    socket.on('error', reject)
  })
}

async function captureSuite(viewport, motionPref, label) {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'hipocampo-sections-'))
  const { child, endpoint } = await launchBrowser(userDataDir)
  const { socket, send } = await connect(endpoint)

  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

    await send('Runtime.enable', {}, sessionId)
    await send('Page.enable', {}, sessionId)
    await send('Emulation.setDeviceMetricsOverride', viewport, sessionId)
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'prefers-reduced-motion', value: motionPref },
        { name: 'hover', value: viewport.mobile ? 'none' : 'hover' },
        { name: 'pointer', value: viewport.mobile ? 'coarse' : 'fine' },
      ],
    }, sessionId)

    await send('Page.navigate', { url: 'http://127.0.0.1:8443/' }, sessionId)
    await sleep(2500)
    await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, sessionId)
    await sleep(1200)

    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId)
      return res.result?.value
    }

    const capture = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
      const filename = `${label}-${motionPref}-${name}.png`
      await writeFile(path.join(outputDir, filename), Buffer.from(data, 'base64'))
      console.log(`Salvo: ${filename}`)
    }

    const scrollTo = async (y) => {
      await evaluate(`window.scrollTo(0, ${Math.round(y)})`)
      await sleep(800)
    }

    // 1. Hero
    await scrollTo(0)
    await capture('hero')

    // 2. Transição (círculo amarelo em expansão)
    const heroHeight = await evaluate(`document.querySelector('#abertura')?.offsetHeight || window.innerHeight`)
    await scrollTo(heroHeight * 0.45)
    await capture('transicao')

    // 3. Página 2 (#projeto)
    const projectTop = await evaluate(`document.querySelector('#projeto')?.offsetTop || 0`)
    await scrollTo(projectTop)
    await capture('pagina2')

    // 4. Mapa de memória
    const mapTop = await evaluate(`(() => {
      const el = document.querySelector('.hipocampo-memory-map');
      return el ? el.getBoundingClientRect().top + window.scrollY - 80 : 0;
    })()`)
    if (mapTop) {
      await scrollTo(mapTop)
      await capture('mapa')
    }

    // 5. Oficina (#oficina)
    const oficinaTop = await evaluate(`document.querySelector('#oficina')?.offsetTop || 0`)
    if (oficinaTop) {
      await scrollTo(oficinaTop + 40)
      await capture('oficina')
    }

    // 6. Instalação (#instalacao)
    const instalacaoTop = await evaluate(`document.querySelector('#instalacao')?.offsetTop || 0`)
    if (instalacaoTop) {
      await scrollTo(instalacaoTop + 40)
      await capture('instalacao')
    }

    // 7. Fragmentos (#fragmentos)
    const fragmentosTop = await evaluate(`document.querySelector('#fragmentos')?.offsetTop || 0`)
    if (fragmentosTop) {
      await scrollTo(fragmentosTop + 40)
      await capture('fragmentos')
    }

    // 8. Fotofilmes (#fotofilmes)
    const fotofilmesTop = await evaluate(`document.querySelector('#fotofilmes')?.offsetTop || 0`)
    if (fotofilmesTop) {
      await scrollTo(fotofilmesTop + 40)
      await capture('fotofilmes')
    }

    // 9. Informações (#informacoes)
    const informacoesTop = await evaluate(`document.querySelector('#informacoes')?.offsetTop || 0`)
    if (informacoesTop) {
      await scrollTo(informacoesTop + 40)
      await capture('informacoes')
    }

    socket.close()
  } finally {
    child.kill()
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function main() {
  const viewports = [
    { label: 'desktop', width: 1916, height: 851, deviceScaleFactor: 1, mobile: false },
    { label: 'mobile', width: 390, height: 844, deviceScaleFactor: 1, mobile: true },
  ]

  for (const vp of viewports) {
    for (const motion of ['no-preference', 'reduce']) {
      console.log(`\nCapturando ${vp.label} com motion=${motion}...`)
      await captureSuite(vp, motion, vp.label)
    }
  }

  console.log('\nTodas as seções capturadas com sucesso em:', outputDir)
}

main().catch((err) => {
  console.error('Erro na captura:', err)
  process.exit(1)
})
