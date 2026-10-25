import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const label = process.argv[2] || 'sample'
const outputDir = path.join(projectRoot, 'artifacts', 'performance-optimization', label)
const siteUrl = process.env.HIPOCAMPO_URL || 'http://127.0.0.1:8443/'
const viewport = { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false }
const forceFinePointer = process.env.HIPOCAMPO_FINE_POINTER === '1'

const browserPath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

if (!browserPath) {
  throw new Error('Chrome/Edge não encontrado para o benchmark.')
}

await mkdir(outputDir, { recursive: true })

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function percentile(values, fraction) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

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

    const timer = setTimeout(() => reject(new Error('O navegador não iniciou.')), 20000)
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
        const request = pending.get(message.id)
        if (!request) return
        pending.delete(message.id)
        if (message.error) request.reject(new Error(message.error.message))
        else request.resolve(message.result)
        return
      }

      const callbacks = handlers.get(message.method) || []
      callbacks.forEach((callback) => callback(message.params, message.sessionId))
    })

    const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
      const id = nextId++
      pending.set(id, { resolve: ok, reject: fail })
      socket.send(JSON.stringify({ id, method, params, sessionId }))
    })

    const on = (event, callback) => {
      if (!handlers.has(event)) handlers.set(event, [])
      handlers.get(event).push(callback)
      return () => {
        const callbacks = handlers.get(event) || []
        const index = callbacks.indexOf(callback)
        if (index >= 0) callbacks.splice(index, 1)
      }
    }

    socket.on('open', () => resolve({ socket, send, on }))
    socket.on('error', reject)
  })
}

function metricsMap(result) {
  return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]))
}

function metricDelta(before, after, name, multiplier = 1) {
  return Number((((after[name] || 0) - (before[name] || 0)) * multiplier).toFixed(3))
}

function processCpuByType(result) {
  return result.processInfo.reduce((totals, process) => {
    totals[process.type] = (totals[process.type] || 0) + process.cpuTime
    return totals
  }, {})
}

function summarizeTrace(events) {
  const tracked = new Set([
    'RunTask',
    'FunctionCall',
    'EvaluateScript',
    'UpdateLayoutTree',
    'Layout',
    'Paint',
    'CompositeLayers',
    'RasterTask',
    'DrawFrame',
    'DroppedFrame',
  ])
  const summary = {}

  for (const event of events) {
    if (!tracked.has(event.name)) continue
    const durationMs = (event.dur || 0) / 1000
    const current = summary[event.name] || { count: 0, totalMs: 0, maxMs: 0 }
    current.count += 1
    current.totalMs += durationMs
    current.maxMs = Math.max(current.maxMs, durationMs)
    summary[event.name] = current
  }

  Object.values(summary).forEach((entry) => {
    entry.totalMs = Number(entry.totalMs.toFixed(3))
    entry.maxMs = Number(entry.maxMs.toFixed(3))
  })
  return summary
}

const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'hipocampo-performance-'))
const { child, endpoint } = await launchBrowser(userDataDir)
const { socket, send, on } = await connect(endpoint)

try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const pageErrors = []
  const failedRequests = []

  on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    pageErrors.push(exceptionDetails.exception?.description || exceptionDetails.text || 'Erro desconhecido')
  })
  on('Network.responseReceived', ({ response }) => {
    if (response.status >= 400) failedRequests.push(`${response.status} ${response.url}`)
  })

  await send('Runtime.enable', {}, sessionId)
  await send('Network.enable', {}, sessionId)
  await send('Page.enable', {}, sessionId)
  await send('Performance.enable', {}, sessionId)
  await send('Emulation.setDeviceMetricsOverride', viewport, sessionId)
  if (forceFinePointer) {
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [
        { name: 'hover', value: 'hover' },
        { name: 'pointer', value: 'fine' },
        { name: 'prefers-reduced-motion', value: 'no-preference' },
      ],
    }, sessionId)
  }
  await send('Page.navigate', { url: siteUrl }, sessionId)
  await sleep(2500)
  await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, sessionId)
  await sleep(1200)

  const evaluate = async (expression, awaitPromise = false) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    }, sessionId)
    return result.result?.value
  }

  async function setScroll(y, settleMs = 500) {
    await evaluate(`window.scrollTo(0, ${Math.round(y)}); true`)
    await sleep(settleMs)
  }

  async function capture(name) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId)
    await writeFile(path.join(outputDir, `${name}.png`), Buffer.from(data, 'base64'))
  }

  async function startTrace() {
    const traceEvents = []
    let complete
    const completed = new Promise((resolve) => { complete = resolve })
    const removeData = on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value))
    const removeComplete = on('Tracing.tracingComplete', () => complete())
    await send('Tracing.start', {
      categories: 'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,cc,gpu',
      transferMode: 'ReportEvents',
    }, sessionId)
    return async () => {
      await send('Tracing.end', {}, sessionId)
      await completed
      removeData()
      removeComplete()
      return traceEvents
    }
  }

  async function startFrameCollection(durationMs) {
    await evaluate(`(() => {
      window.__hipocampoPerfFrames = [];
      window.__hipocampoPerfLongTasks = [];
      window.__hipocampoPerfEnd = performance.now() + ${durationMs};
      window.__hipocampoPerfLast = 0;
      window.__hipocampoPerfObserver?.disconnect();
      window.__hipocampoPerfObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => window.__hipocampoPerfLongTasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
        }));
      });
      try { window.__hipocampoPerfObserver.observe({ type: 'longtask', buffered: false }); } catch {}
      const tick = (time) => {
        if (window.__hipocampoPerfLast) {
          window.__hipocampoPerfFrames.push(time - window.__hipocampoPerfLast);
        }
        window.__hipocampoPerfLast = time;
        if (time < window.__hipocampoPerfEnd) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return true;
    })()`)
  }

  async function readFrameCollection() {
    return evaluate(`(() => {
      window.__hipocampoPerfObserver?.disconnect();
      return {
        frames: window.__hipocampoPerfFrames || [],
        longTasks: window.__hipocampoPerfLongTasks || [],
      };
    })()`)
  }

  async function measure(name, { duration = 3000, setup, action } = {}) {
    if (setup) await setup()
    await sleep(600)
    const before = metricsMap(await send('Performance.getMetrics', {}, sessionId))
    const processBefore = processCpuByType(await send('SystemInfo.getProcessInfo'))
    await startFrameCollection(duration)
    const actionPromise = action ? action(duration) : Promise.resolve()
    await sleep(duration + 150)
    await actionPromise
    const framesResult = await readFrameCollection()
    const after = metricsMap(await send('Performance.getMetrics', {}, sessionId))
    const processAfter = processCpuByType(await send('SystemInfo.getProcessInfo'))
    const frames = framesResult.frames.filter((value) => value > 0 && value < 250)
    const result = {
      durationMs: duration,
      frames: frames.length,
      estimatedFps: Number((frames.length / (duration / 1000)).toFixed(2)),
      medianFrameMs: Number(percentile(frames, 0.5).toFixed(3)),
      p95FrameMs: Number(percentile(frames, 0.95).toFixed(3)),
      p99FrameMs: Number(percentile(frames, 0.99).toFixed(3)),
      maxFrameMs: Number(Math.max(0, ...frames).toFixed(3)),
      framesOver20Ms: frames.filter((value) => value > 20).length,
      framesOver33Ms: frames.filter((value) => value > 33.4).length,
      longTasks: framesResult.longTasks,
      taskMs: metricDelta(before, after, 'TaskDuration', 1000),
      scriptMs: metricDelta(before, after, 'ScriptDuration', 1000),
      layoutMs: metricDelta(before, after, 'LayoutDuration', 1000),
      styleMs: metricDelta(before, after, 'RecalcStyleDuration', 1000),
      layoutCount: metricDelta(before, after, 'LayoutCount'),
      styleCount: metricDelta(before, after, 'RecalcStyleCount'),
      jsHeapDeltaBytes: metricDelta(before, after, 'JSHeapUsedSize'),
      jsHeapUsedBytes: Math.round(after.JSHeapUsedSize || 0),
      domNodes: Math.round(after.Nodes || 0),
      rendererCpuMs: Number((((processAfter.renderer || 0) - (processBefore.renderer || 0)) * 1000).toFixed(3)),
      gpuCpuMs: Number((((processAfter.GPU || 0) - (processBefore.GPU || 0)) * 1000).toFixed(3)),
    }
    console.log(`${name}: ${result.estimatedFps} fps, p95 ${result.p95FrameMs} ms, task ${result.taskMs} ms`)
    return result
  }

  async function animateScroll(from, to, duration) {
    await evaluate(`(() => {
      const from = ${Math.round(from)};
      const to = ${Math.round(to)};
      const duration = ${duration};
      const started = performance.now();
      const step = (now) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration));
        const eased = 0.5 - Math.cos(Math.PI * progress) / 2;
        window.scrollTo(0, from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return true;
    })()`)
  }

  async function movePointer(points, duration) {
    await evaluate(`(() => {
      const points = ${JSON.stringify(points)};
      const duration = ${duration};
      const started = performance.now();
      const step = (now) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration));
        const point = points[Math.min(points.length - 1, Math.floor(progress * points.length))];
        const target = document.elementFromPoint(point[0], point[1]) || document.body;
        target.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          clientX: point[0],
          clientY: point[1],
          pointerId: 1,
          pointerType: 'mouse',
        }));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      return true;
    })()`)
  }

  const viewportHeight = viewport.height
  const heroEnd = viewportHeight * 1.8
  const documentInfo = await evaluate(`(() => ({
    height: document.documentElement.scrollHeight,
    installationTop: document.querySelector('#instalacao')?.offsetTop || 0,
    installationHeight: document.querySelector('#instalacao')?.offsetHeight || 0,
    projectTop: document.querySelector('#projeto')?.offsetTop || 0,
    canvasCount: document.querySelectorAll('#instalacao canvas').length,
  }))()`)

  const results = {}
  results.idleTop = await measure('idleTop', {
    setup: () => setScroll(0),
  })

  results.heroScroll = await measure('heroScroll', {
    duration: 3400,
    setup: () => setScroll(0),
    action: (duration) => animateScroll(0, heroEnd, duration - 250),
  })

  const heroPointerPoints = Array.from({ length: 100 }, (_, index) => {
    const x = 160 + (index * 137) % 1280
    const y = 330 + Math.sin(index * 0.55) * 190
    return [Math.round(x), Math.round(y)]
  })
  results.heroPointer = await measure('heroPointer', {
    duration: 3000,
    setup: () => setScroll(0),
    action: (duration) => movePointer(heroPointerPoints, duration),
  })

  results.page2Pointer = await measure('page2Pointer', {
    duration: 3000,
    setup: async () => {
      await setScroll(heroEnd + viewportHeight * 0.55)
    },
    action: async (duration) => {
      const rects = await evaluate(`[...document.querySelectorAll('.page2-photo')].map((photo) => {
        const rect = photo.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      }).filter((rect) => rect.bottom !== 0 && rect.y < innerHeight && rect.y + rect.height > 0)`)
      const visible = rects.length ? rects : [{ x: 400, y: 250, width: 500, height: 350 }]
      const points = Array.from({ length: 90 }, (_, index) => {
        const rect = visible[index % visible.length]
        return [
          Math.round(Math.max(1, Math.min(viewport.width - 2, rect.x + rect.width * ((index % 9) / 8)))),
          Math.round(Math.max(1, Math.min(viewport.height - 2, rect.y + rect.height * (((index * 5) % 9) / 8)))),
        ]
      })
      await movePointer(points, duration)
    },
  })

  const editorialStart = heroEnd + viewportHeight
  const editorialEnd = Math.max(editorialStart, documentInfo.height - viewportHeight)
  results.editorialScroll = await measure('editorialScroll', {
    duration: 5200,
    setup: () => setScroll(editorialStart),
    action: (duration) => animateScroll(editorialStart, editorialEnd, duration - 250),
  })

  const installationScroll = Math.max(0, documentInfo.installationTop + documentInfo.installationHeight * 0.35 - viewportHeight * 0.5)
  results.installationVisible = await measure('installationVisible', {
    duration: 3500,
    setup: async () => {
      await setScroll(installationScroll)
      await sleep(1000)
    },
    action: async (duration) => {
      const canvas = await evaluate(`(() => {
        const canvas = document.querySelector('#instalacao canvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      })()`)
      if (!canvas) return
      const points = Array.from({ length: 100 }, (_, index) => [
        Math.round(Math.max(1, Math.min(viewport.width - 2, canvas.x + canvas.width * (0.25 + (index % 20) / 40)))),
        Math.round(Math.max(1, Math.min(viewport.height - 2, canvas.y + canvas.height * (0.35 + Math.sin(index / 6) * 0.12)))),
      ])
      await movePointer(points, duration)
    },
  })

  results.installationOffscreen = await measure('installationOffscreen', {
    duration: 3500,
    setup: async () => {
      await setScroll(0)
      await sleep(1000)
    },
  })

  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    await setScroll(heroEnd * progress, 1400)
    await capture(`hero-${String(Math.round(progress * 100)).padStart(3, '0')}`)
  }

  const runtimeState = await evaluate(`(() => {
    const circle = document.querySelector('.hipocampo-transition-circle');
    const legacyCursor = [...document.querySelectorAll('body > #root > div')]
      .find((element) => element.classList.contains('fixed') && element.classList.contains('w-6'));
    const circleRect = circle?.getBoundingClientRect();
    const installationRect = document.querySelector('#instalacao')?.getBoundingClientRect();
    return {
      circleTag: circle?.tagName || null,
      circleColor: circle ? getComputedStyle(circle).backgroundColor : null,
      circleRect: circleRect ? { x: circleRect.x, y: circleRect.y, width: circleRect.width, height: circleRect.height } : null,
      installationRect: installationRect ? { top: installationRect.top, bottom: installationRect.bottom } : null,
      canvasCount: document.querySelectorAll('#instalacao canvas').length,
      legacyCursorDisplay: legacyCursor ? getComputedStyle(legacyCursor).display : null,
      editorialCursorCount: document.querySelectorAll('.hipocampo-editorial-cursor').length,
      finePointer: matchMedia('(hover: hover) and (pointer: fine)').matches,
      coarsePointer: matchMedia('(hover: none), (pointer: coarse)').matches,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      editorialMotionReady: document.documentElement.dataset.editorialMotionReady || null,
      heroMotionReady: document.querySelector('.hipocampo-memory-field')?.dataset.heroMotionReady || null,
      scrollTriggers: document.querySelectorAll('.pin-spacer').length,
      xOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`)

  const report = {
    label,
    browserPath,
    siteUrl,
    viewport,
    capturedAt: new Date().toISOString(),
    documentInfo,
    runtimeState,
    scenarios: results,
    pageErrors,
    failedRequests,
  }

  await writeFile(
    path.join(outputDir, 'metrics.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(`Relatório salvo em ${path.join(outputDir, 'metrics.json')}`)
} finally {
  socket.close()
  child.kill()
  child.stdout?.destroy()
  child.stderr?.destroy()
  child.unref()
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {})
}
