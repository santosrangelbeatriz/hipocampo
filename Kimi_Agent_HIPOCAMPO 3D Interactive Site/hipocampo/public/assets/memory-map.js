import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'

const MANIFEST_URL = '/images/map/manifest.json'
const INTERPOLATION = 0.08
const REDUCED_MOTION_FACTOR = 0.5

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function rotatePoint(x, y, originX, originY, radians) {
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  const offsetX = x - originX
  const offsetY = y - originY
  return {
    x: originX + (offsetX * cosine) - (offsetY * sine),
    y: originY + (offsetX * sine) + (offsetY * cosine),
  }
}

async function mountMemoryMap(container) {
  if (container.dataset.memoryMapReady === 'true') return

  window.__hipocampoMemoryMapCleanup?.()
  const controller = new AbortController()
  const response = await fetch(MANIFEST_URL, { signal: controller.signal })
  if (!response.ok) throw new Error(`Não foi possível carregar o mapa de memória (${response.status}).`)
  const manifest = await response.json()

  if (!container.isConnected) return

  const canvas = document.createElement('canvas')
  canvas.className = 'memory-map-lines'
  canvas.setAttribute('aria-hidden', 'true')
  const context = canvas.getContext('2d', { alpha: true })

  const pieces = manifest.pieces.map((data, index) => {
    const frame = document.createElement('span')
    frame.className = 'memory-map-piece-frame'
    frame.dataset.pieceId = data.id
    frame.dataset.pieceType = data.tipo
    frame.style.left = `${data.x / manifest.width * 100}%`
    frame.style.top = `${data.y / manifest.height * 100}%`
    frame.style.width = `${data.w / manifest.width * 100}%`
    frame.style.height = `${data.h / manifest.height * 100}%`
    if (data.tipo === 'casa') frame.style.zIndex = '3'

    const image = document.createElement('img')
    image.className = 'memory-map-piece'
    image.src = data.src
    image.alt = ''
    image.loading = 'eager'
    image.decoding = 'async'
    image.draggable = false
    image.style.transformOrigin = `${(data.center.xPct / 100 * manifest.width - data.x) / data.w * 100}% ${(data.center.yPct / 100 * manifest.height - data.y) / data.h * 100}%`
    frame.append(image)

    return {
      data,
      frame,
      image,
      phase: index * 0.73,
      x: 0,
      y: 0,
      rotation: 0,
      handAngle: 0,
      targetX: 0,
      targetY: 0,
      targetRotation: 0,
      targetHandAngle: 0,
    }
  })

  container.style.setProperty('--memory-map-aspect', String(manifest.aspectRatio))
  container.replaceChildren(canvas, ...pieces.map((piece) => piece.frame))
  container.dataset.memoryMapReady = 'true'
  container.dataset.memoryMapDecoded = 'false'

  await Promise.allSettled(pieces.map(({ image }) => image.decode()))
  if (!container.isConnected) return
  container.dataset.memoryMapDecoded = 'true'

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)')
  const pointer = { localX: 0, localY: 0, clientX: 0, clientY: 0, active: false }
  let visible = false
  let destroyed = false
  let tickerActive = false
  let idleFrame = 0
  let canvasWidth = 0
  let canvasHeight = 0
  let devicePixelRatio = 1

  let containerWidth = 0
  let containerHeight = 0

  const resizeCanvas = (width, height) => {
    const nextDpr = clamp(window.devicePixelRatio || 1, 1, 2)
    if (width === canvasWidth && height === canvasHeight && nextDpr === devicePixelRatio) return

    canvasWidth = width
    canvasHeight = height
    devicePixelRatio = nextDpr
    canvas.width = Math.max(1, Math.round(width * nextDpr))
    canvas.height = Math.max(1, Math.round(height * nextDpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0)
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const cr = entry.contentRect
      if (cr.width && cr.height) {
        containerWidth = cr.width
        containerHeight = cr.height
        resizeCanvas(containerWidth, containerHeight)
      }
    }
  })
  resizeObserver.observe(container)

  const pieceGeometry = (piece, width, height) => {
    const centerX = piece.data.center.xPct / 100 * width
    const centerY = piece.data.center.yPct / 100 * height
    const houseX = piece.data.anchorHouse.xPct / 100 * width
    const houseY = piece.data.anchorHouse.yPct / 100 * height
    const orbitAngle = piece.handAngle * Math.PI / 180
    const orbitCenter = piece.data.tipo === 'mao'
      ? rotatePoint(centerX, centerY, houseX, houseY, orbitAngle)
      : { x: centerX, y: centerY }
    const orbitX = orbitCenter.x - centerX
    const orbitY = orbitCenter.y - centerY
    const rotation = (piece.rotation + piece.handAngle) * Math.PI / 180
    const anchor = rotatePoint(
      piece.data.anchorPiece.xPct / 100 * width,
      piece.data.anchorPiece.yPct / 100 * height,
      centerX,
      centerY,
      rotation,
    )

    return {
      translateX: piece.x + orbitX,
      translateY: piece.y + orbitY,
      rotationDegrees: piece.rotation + piece.handAngle,
      anchorX: anchor.x + piece.x + orbitX,
      anchorY: anchor.y + piece.y + orbitY,
      houseX,
      houseY,
    }
  }

  const render = (time) => {
    if (destroyed || !visible || !container.isConnected) return

    const width = containerWidth
    const height = containerHeight
    if (!width || !height) return

    const motionFactor = reducedMotion.matches ? REDUCED_MOTION_FACTOR : 1
    const allowRepulsion = !coarsePointer.matches && pointer.active
    if (allowRepulsion) {
      const rect = container.getBoundingClientRect()
      pointer.localX = pointer.clientX - rect.left
      pointer.localY = pointer.clientY - rect.top
    }
    const repulsionRadius = Math.max(width, height) * 0.4
    const maximumPush = Math.min(width, height) * 0.095 * motionFactor

    pieces.forEach((piece) => {
      if (piece.data.tipo === 'casa') {
        piece.targetX = 0
        piece.targetY = 0
        piece.targetRotation = 0
        piece.targetHandAngle = 0
      } else {
        const centerX = piece.data.center.xPct / 100 * width
        const centerY = piece.data.center.yPct / 100 * height
        const idleX = Math.sin((time * 0.00042) + piece.phase) * 2.2 * motionFactor
        const idleY = Math.cos((time * 0.00036) + piece.phase * 1.17) * 1.9 * motionFactor
        const idleRotation = Math.sin((time * 0.00025) + piece.phase) * 0.38 * motionFactor
        piece.targetX = idleX
        piece.targetY = idleY
        piece.targetRotation = idleRotation
        piece.targetHandAngle = 0

        if (allowRepulsion) {
          const deltaX = centerX - pointer.localX
          const deltaY = centerY - pointer.localY
          const distance = Math.hypot(deltaX, deltaY)
          if (distance < repulsionRadius) {
            const normalizedX = distance > 0.1 ? deltaX / distance : Math.cos(piece.phase)
            const normalizedY = distance > 0.1 ? deltaY / distance : Math.sin(piece.phase)
            const strength = (1 - distance / repulsionRadius) ** 2
            piece.targetX += normalizedX * maximumPush * strength
            piece.targetY += normalizedY * maximumPush * strength
            piece.targetRotation += (normalizedX - normalizedY) * 3.8 * strength * motionFactor
            if (piece.data.tipo === 'mao') {
              piece.targetHandAngle = normalizedX * 1.45 * strength * motionFactor
            }
          }
        }
      }

      piece.x += (piece.targetX - piece.x) * INTERPOLATION
      piece.y += (piece.targetY - piece.y) * INTERPOLATION
      piece.rotation += (piece.targetRotation - piece.rotation) * INTERPOLATION
      piece.handAngle += (piece.targetHandAngle - piece.handAngle) * INTERPOLATION
    })

    context.clearRect(0, 0, width, height)
    context.strokeStyle = manifest.lineColor
    context.lineWidth = Math.max(0.7, width * manifest.lineWidthPct / 100)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()

    pieces.forEach((piece) => {
      const geometry = pieceGeometry(piece, width, height)
      piece.image.style.transform = `translate3d(${geometry.translateX.toFixed(3)}px, ${geometry.translateY.toFixed(3)}px, 0) rotate(${geometry.rotationDegrees.toFixed(3)}deg)`
      if (piece.data.tipo === 'casa') return
      context.moveTo(geometry.houseX, geometry.houseY)
      context.lineTo(geometry.anchorX, geometry.anchorY)
    })
    context.stroke()
  }

  const tickerRender = (time) => {
    if (!pointer.active) {
      idleFrame = (idleFrame + 1) % 2
      if (idleFrame !== 0) return
    }
    render(time * 1000)
  }

  const heroPinFinished = () => {
    const heroTrigger = ScrollTrigger.getById('hipocampo-page1-page2')
    return !heroTrigger || heroTrigger.progress >= 0.999
  }

  const start = () => {
    if (!destroyed && visible && heroPinFinished() && !tickerActive) {
      tickerActive = true
      const rect = container.getBoundingClientRect()
      if (rect.width && rect.height) {
        containerWidth = rect.width
        containerHeight = rect.height
        resizeCanvas(containerWidth, containerHeight)
      }
      gsap.ticker.add(tickerRender)
    }
  }

  const stop = () => {
    if (tickerActive) {
      gsap.ticker.remove(tickerRender)
      tickerActive = false
    }
  }

  const updateActivity = () => {
    if (visible && heroPinFinished()) start()
    else stop()
  }

  const onPointerMove = (event) => {
    if (destroyed || !visible || coarsePointer.matches) return
    // Só guarda a posição; a geometria é lida uma vez por quadro em render().
    pointer.clientX = event.clientX
    pointer.clientY = event.clientY
    pointer.active = true
  }
  const clearPointer = () => { pointer.active = false }
  const onPointerOut = (event) => {
    if (!event.relatedTarget) clearPointer()
  }
  const onMotionPreferenceChange = () => start()

  const intersectionObserver = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting === true
    updateActivity()
  }, { threshold: 0.01 })

  intersectionObserver.observe(container)
  window.addEventListener('hipocampo:hero-pin-state', updateActivity)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('blur', clearPointer)
  document.addEventListener('pointerout', onPointerOut, { passive: true })
  reducedMotion.addEventListener('change', onMotionPreferenceChange)
  coarsePointer.addEventListener('change', clearPointer)

  const cleanup = () => {
    if (destroyed) return
    destroyed = true
    controller.abort()
    stop()
    resizeObserver.disconnect()
    intersectionObserver.disconnect()
    window.removeEventListener('hipocampo:hero-pin-state', updateActivity)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('blur', clearPointer)
    document.removeEventListener('pointerout', onPointerOut)
    reducedMotion.removeEventListener('change', onMotionPreferenceChange)
    coarsePointer.removeEventListener('change', clearPointer)
    delete container.dataset.memoryMapReady
    delete container.dataset.memoryMapDecoded
    delete window.__hipocampoMemoryMapCleanup
  }

  window.__hipocampoMemoryMapCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  container.dispatchEvent(new CustomEvent('hipocampo:memory-map-ready', { bubbles: true }))
}

function initializeMemoryMap() {
  const container = document.querySelector('[data-memory-map]')
  if (!container) return false
  mountMemoryMap(container).catch((error) => {
    if (error.name !== 'AbortError') console.error(error)
  })
  return true
}

if (!initializeMemoryMap()) {
  const observer = new MutationObserver(() => {
    if (initializeMemoryMap()) observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
