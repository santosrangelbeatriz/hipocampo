import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const artifactsDir = path.join(projectRoot, 'artifacts', 'hero-photo-qa')
await mkdir(artifactsDir, { recursive: true })

const CHROME_PATH = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p))

console.log('Using browser executable:', CHROME_PATH)

function launchBrowser(userDataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ])
    const timer = setTimeout(() => reject(new Error('Browser did not start.')), 20000)
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
    const handlers = new Map()
    let nextId = 1

    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString())
      if (message.id) {
        const req = pending.get(message.id)
        if (req) {
          pending.delete(message.id)
          if (message.error) req.reject(new Error(message.error.message))
          else req.resolve(message.result)
        }
      } else if (message.method) {
        const handlerList = handlers.get(message.method) || []
        handlerList.forEach(fn => fn(message.params))
      }
    })

    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const id = nextId++
      pending.set(id, { resolve: ok, reject: fail })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

    const on = (event, fn) => {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event).push(fn)
    }

    socket.on('open', () => resolve({ socket, send, on }))
    socket.on('error', reject)
  })
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function runScenario(motionPreference) {
  console.log(`\n========================================`)
  console.log(`Testing reduced_motion = "${motionPreference}"`)
  console.log(`========================================`)

  const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'hipocampo-qa-'))
  const { child, endpoint } = await launchBrowser(userDataDir)
  const { socket, send, on } = await connect(endpoint)

  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })

    const consoleErrors = []
    const failed404s = []

    on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const text = params.args.map(a => a.value || a.description || '').join(' ')
        consoleErrors.push(text)
        console.error('[Browser console.error]:', text)
      }
    })

    on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      const text = exceptionDetails.exception?.description || exceptionDetails.text || 'Erro desconhecido'
      consoleErrors.push(text)
      console.error('[Browser exception]:', text)
    })

    on('Network.responseReceived', (params) => {
      if (params.response.status >= 400) {
        const entry = `${params.response.status} ${params.response.url}`
        failed404s.push(entry)
        console.error('[Browser HTTP Error]:', entry)
      }
    })

    await send('Runtime.enable', {}, sessionId)
    await send('Network.enable', {}, sessionId)
    await send('Page.enable', {}, sessionId)

    // Configurar viewport de aceite: 1920 x 1080
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId)

    // Configurar prefers-reduced-motion
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: motionPreference }]
    }, sessionId)

    // Navegar
    console.log('Navigating to http://127.0.0.1:8443/ ...')
    await send('Page.navigate', { url: 'http://127.0.0.1:8443/' }, sessionId)
    await sleep(2000)

    // Aguardar fontes prontas
    await send('Runtime.evaluate', {
      expression: 'document.fonts.ready',
      awaitPromise: true,
    }, sessionId)
    await sleep(800)

    // Função auxiliar para tirar screenshot
    async function takeScreenshot(name) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
      const filepath = path.join(artifactsDir, `${motionPreference}-${name}.png`)
      await writeFile(filepath, Buffer.from(data, 'base64'))
      console.log(`Saved screenshot: ${motionPreference}-${name}.png`)
    }

    // Screenshot inicial (sem hover)
    await takeScreenshot('00-initial')

    // Medir as 8 linhas
    const evalLines = await send('Runtime.evaluate', {
      expression: `(() => {
        const field = document.querySelector('.hipocampo-memory-field')
        if (!field) return []
        const spans = [...field.querySelectorAll(':scope > span')]
        return spans.map((s, i) => {
          const r = s.getBoundingClientRect()
          return { index: i + 1, x: r.x, y: r.y, width: r.width, height: r.height }
        })
      })()`,
      returnByValue: true,
    }, sessionId)

    const lines = evalLines.result.value
    if (!lines?.length) {
      throw new Error(`Hero não montou. Erros do navegador: ${consoleErrors.join(' | ') || 'nenhum capturado'}`)
    }
    console.log(`Found ${lines.length} lines in memory field`)

    // Mover o mouse sobre as linhas 1, 4 e 8
    const testLines = [1, 4, 8]
    for (const lineNum of testLines) {
      const line = lines[lineNum - 1]
      const hoverX = Math.round(line.x + line.width * 0.5)
      const hoverY = Math.round(line.y + line.height * 0.5)

      console.log(`Hovering line ${lineNum} at (${hoverX}, ${hoverY})...`)
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: hoverX,
        y: hoverY,
      }, sessionId)

      // Aguardar o fade (300ms) e zoom (600ms)
      await sleep(700)

      // Checar estado no DOM
      const evalState = await send('Runtime.evaluate', {
        expression: `(() => {
          const lNum = ${lineNum};
          const layer = document.querySelector('.hipocampo-photo-text-layer[data-photo-line="' + lNum + '"]');
          const span = document.querySelectorAll('.hipocampo-memory-field > span')[lNum - 1];
          const otherLayers = [...document.querySelectorAll('.hipocampo-photo-text-layer')]
            .filter(l => l.dataset.photoLine !== String(lNum))
            .map(l => ({ line: l.dataset.photoLine, opacity: getComputedStyle(l).opacity, vis: getComputedStyle(l).visibility }));
          
          return {
            activeLayer: {
              line: lNum,
              bgImg: getComputedStyle(layer).backgroundImage,
              opacity: getComputedStyle(layer).opacity,
              visibility: getComputedStyle(layer).visibility,
              clip: getComputedStyle(layer).webkitBackgroundClip || getComputedStyle(layer).backgroundClip,
              fillColor: getComputedStyle(layer).webkitTextFillColor,
              stroke: getComputedStyle(layer).webkitTextStroke,
              zoom: getComputedStyle(layer).getPropertyValue('--photo-zoom')
            },
            spanDimmed: span.classList.contains('hipocampo-photo-line-dimmed'),
            spanOpacity: getComputedStyle(span).opacity,
            otherLayersNormal: otherLayers.every(l => l.opacity === '0' || l.vis === 'hidden')
          };
        })()`,
        returnByValue: true,
      }, sessionId)

      console.log(`Line ${lineNum} DOM state:`, JSON.stringify(evalState.result.value, null, 2))
      await takeScreenshot(`hover-line-${lineNum}`)

      // Testar parallax horizontal
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(line.x + line.width * 0.25),
        y: hoverY,
      }, sessionId)
      await sleep(300)
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(line.x + line.width * 0.75),
        y: hoverY,
      }, sessionId)
      await sleep(300)
    }

    // Tirar mouse para fora (voltar ao amarelo)
    console.log('Moving mouse away (to 10, 10)...')
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 10,
      y: 10,
    }, sessionId)
    await sleep(600)
    await takeScreenshot('04-after-leave')

    // Checar se voltou ao normal
    const evalReturned = await send('Runtime.evaluate', {
      expression: `(() => {
        const layers = [...document.querySelectorAll('.hipocampo-photo-text-layer')];
        const allHidden = layers.every(l => getComputedStyle(l).opacity === '0' || getComputedStyle(l).visibility === 'hidden');
        const dimmedSpans = document.querySelectorAll('.hipocampo-photo-line-dimmed').length;
        return { allHidden, dimmedSpans };
      })()`,
      returnByValue: true,
    }, sessionId)
    console.log('Returned to normal check:', evalReturned.result.value)

    // Testar scroll: rolar a página
    console.log('Testing scroll transition...')
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, window.innerHeight * 0.4)',
    }, sessionId)
    await sleep(500)

    const evalScroll = await send('Runtime.evaluate', {
      expression: `(() => {
        const scene = document.querySelector('#abertura');
        const progress = Number.parseFloat(scene.style.getPropertyValue('--hipocampo-scroll-progress')) || 0;
        const circleScale = Number.parseFloat(scene.querySelector('.hipocampo-transition-circle').style.getPropertyValue('--hipocampo-circle-scale')) || 1;
        const photoOverlay = document.querySelector('.hipocampo-photo-text');
        const photoVis = getComputedStyle(photoOverlay).visibility;
        const photoOp = getComputedStyle(photoOverlay).opacity;
        return { progress, circleScale, photoVis, photoOp };
      })()`,
      returnByValue: true,
    }, sessionId)
    console.log('Scroll state (40%):', evalScroll.result.value)
    await takeScreenshot('05-scrolled')

    // Voltar o scroll ao topo
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, 0)',
    }, sessionId)
    await sleep(500)

    console.log(`\nScenario "${motionPreference}" completed:`)
    console.log(`- Console errors: ${consoleErrors.length}`, consoleErrors)
    console.log(`- 404 / HTTP errors: ${failed404s.length}`, failed404s)

    socket.close()
  } finally {
    child.kill()
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function main() {
  await runScenario('no-preference')
  await runScenario('reduce')
  console.log('\nAll QA tests completed successfully!')
}

main().catch(err => {
  console.error('QA failed:', err)
  process.exit(1)
})
