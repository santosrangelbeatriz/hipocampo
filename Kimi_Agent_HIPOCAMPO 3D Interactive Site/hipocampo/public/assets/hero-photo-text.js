import { n as gsap } from './index-BXEErpTi.js'

// Defina como true para desligar a foto dentro do texto quando o sistema pedir menos movimento.
const RESPECT_REDUCED_MOTION = false
const SCROLL_INTERACTION_LIMIT = 0.05
const SCROLL_RESTORE_LIMIT = 0.0005
const PARALLAX_RANGE = 0.08
const ZOOM_FROM = 1.15
const FADE_SECONDS = 0.3
const ZOOM_SECONDS = 0.6
const LINE_HIT_PADDING = 24

// Linha N usa foto-0N; foto-09 fica de reserva. focusY escolhe a faixa
// horizontal mais legível de cada foto; bright compensa fotos escuras no azul.
const PHOTOS = [
  { src: '/images/hero/foto-01.webp', focusY: '48%', bright: false },
  { src: '/images/hero/foto-02.webp', focusY: '46%', bright: true },
  { src: '/images/hero/foto-03.webp', focusY: '38%', bright: false },
  { src: '/images/hero/foto-04.webp', focusY: '46%', bright: false },
  { src: '/images/hero/foto-05.webp', focusY: '60%', bright: false },
  { src: '/images/hero/foto-06.webp', focusY: '56%', bright: false },
  { src: '/images/hero/foto-07.webp', focusY: '46%', bright: false },
  { src: '/images/hero/foto-08.webp', focusY: '30%', bright: true },
  { src: '/images/hero/foto-09.webp', focusY: '28%', bright: true },
]

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function createPhotoOverlay(lines) {
  const overlay = document.createElement('div')
  overlay.className = 'hipocampo-photo-text'
  overlay.setAttribute('aria-hidden', 'true')

  const layers = lines.map((line, index) => {
    const photo = PHOTOS[index]
    const layer = document.createElement('span')
    layer.className = 'hipocampo-photo-text-layer'
    layer.dataset.photoLine = String(index + 1)
    layer.textContent = line.textContent
    layer.style.setProperty('--photo-focus-y', photo.focusY)
    if (photo.bright) layer.classList.add('hipocampo-photo-text-bright')
    overlay.append(layer)

    return { line, layer, photo, rect: null, fadeTween: null, zoomTween: null }
  })

  return { overlay, layers }
}

function initializeHeroPhotoText() {
  const scene = document.querySelector('#abertura')
  const visuals = scene?.querySelector('.hipocampo-hero-visuals')
  const field = visuals?.querySelector('.hipocampo-memory-field')
  const lines = field ? [...field.querySelectorAll(':scope > span')].slice(0, 8) : []

  if (!scene || !visuals || !field || lines.length !== 8) return false
  if (field.dataset.photoTextReady === 'true') return true

  window.__hipocampoHeroPhotoTextCleanup?.()
  field.dataset.photoTextReady = 'true'

  const { overlay, layers } = createPhotoOverlay(lines)
  visuals.append(overlay)

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const desktopViewport = window.matchMedia('(min-width: 768px)')
  const reduceMotionRequested = RESPECT_REDUCED_MOTION
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const parallax = { x: 0 }
  const moveParallax = gsap.quickTo(parallax, 'x', {
    duration: 0.5,
    ease: 'power3.out',
  })

  const preloadedImages = []
  let fieldBounds = null
  let heroVisible = true
  let transitionActive = false
  let interactionEnabled = false
  let activeIndex = -1
  let measureFrame = 0
  let destroyed = false

  const measure = () => {
    measureFrame = 0
    const visualsRect = visuals.getBoundingClientRect()
    const fieldStyle = getComputedStyle(field)
    let top = Infinity
    let bottom = -Infinity

    layers.forEach((entry) => {
      const rect = entry.line.getBoundingClientRect()
      entry.rect = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
      }
      top = Math.min(top, rect.top)
      bottom = Math.max(bottom, rect.bottom)

      const { layer } = entry
      layer.style.width = `${rect.width}px`
      layer.style.height = `${rect.height}px`
      layer.style.fontFamily = fieldStyle.fontFamily
      layer.style.fontSize = fieldStyle.fontSize
      layer.style.fontWeight = fieldStyle.fontWeight
      layer.style.letterSpacing = fieldStyle.letterSpacing
      layer.style.lineHeight = fieldStyle.lineHeight
      layer.style.textAlign = fieldStyle.textAlign
      layer.style.transform = `translate3d(${(rect.left - visualsRect.left).toFixed(2)}px, ${(rect.top - visualsRect.top).toFixed(2)}px, 0)`
    })

    fieldBounds = { top, bottom }
  }

  const requestMeasure = () => {
    if (destroyed || !interactionEnabled || measureFrame) return
    measureFrame = requestAnimationFrame(measure)
  }

  const stripesLayerFor = (index) => visuals.querySelector(
    `.hipocampo-memory-stripes-layer[data-stripes-line="${index + 1}"]`,
  )

  const showLayer = (index) => {
    const entry = layers[index]
    entry.line.classList.add('hipocampo-photo-line-dimmed')
    stripesLayerFor(index)?.classList.add('hipocampo-photo-stripes-muted')

    entry.fadeTween?.kill()
    entry.zoomTween?.kill()
    entry.fadeTween = gsap.to(entry.layer, {
      autoAlpha: 1,
      duration: FADE_SECONDS,
      ease: 'power2.out',
    })
    entry.zoomTween = gsap.fromTo(
      entry.layer,
      { '--photo-zoom': ZOOM_FROM },
      { '--photo-zoom': 1, duration: ZOOM_SECONDS, ease: 'power2.out' },
    )
  }

  const hideLayer = (index, immediate = false) => {
    const entry = layers[index]
    entry.line.classList.remove('hipocampo-photo-line-dimmed')
    stripesLayerFor(index)?.classList.remove('hipocampo-photo-stripes-muted')

    entry.fadeTween?.kill()
    entry.zoomTween?.kill()
    entry.zoomTween = null

    if (immediate) {
      entry.fadeTween = null
      gsap.set(entry.layer, { autoAlpha: 0 })
      return
    }

    entry.fadeTween = gsap.to(entry.layer, {
      autoAlpha: 0,
      duration: FADE_SECONDS,
      ease: 'power2.out',
    })
  }

  const setActiveLine = (index, immediate = false) => {
    if (index === activeIndex) return
    if (activeIndex >= 0) hideLayer(activeIndex, immediate)
    activeIndex = index
    if (activeIndex >= 0) showLayer(activeIndex)
  }

  const lineIndexAt = (x, y) => {
    if (!fieldBounds || y < fieldBounds.top || y > fieldBounds.bottom) return -1

    return layers.findIndex(({ rect }) => (
      rect
      && y >= rect.top
      && y < rect.bottom
      && x >= rect.left - LINE_HIT_PADDING
      && x <= rect.right + LINE_HIT_PADDING
    ))
  }

  const canInteract = () => interactionEnabled && heroVisible && !transitionActive

  const onPointerMove = (event) => {
    if (!canInteract()) return

    const index = lineIndexAt(event.clientX, event.clientY)
    setActiveLine(index)
    if (index < 0) return

    const { rect } = layers[index]
    const normalizedX = clamp((event.clientX - rect.left) / rect.width) * 2 - 1
    moveParallax(normalizedX * PARALLAX_RANGE * rect.width)
  }

  const onPointerLeave = () => setActiveLine(-1)

  const syncTransitionState = () => {
    const progress = Number.parseFloat(
      scene.style.getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0

    if (!transitionActive && progress > SCROLL_INTERACTION_LIMIT) {
      transitionActive = true
      setActiveLine(-1, true)
    } else if (transitionActive && progress <= SCROLL_RESTORE_LIMIT) {
      transitionActive = false
      requestMeasure()
    }
  }

  const tickerRender = () => {
    syncTransitionState()
    overlay.style.setProperty('--photo-shift', `${parallax.x.toFixed(2)}px`)
  }

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
    if (!heroVisible) setActiveLine(-1, true)
  }, { rootMargin: '10% 0px' })

  const preloadPhotos = () => {
    if (destroyed || preloadedImages.length) return
    PHOTOS.forEach((photo) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = photo.src
      preloadedImages.push(image)
    })
    layers.forEach(({ layer, photo }) => {
      layer.style.backgroundImage = `url("${photo.src}")`
    })
  }

  const disableInteraction = () => {
    if (!interactionEnabled) return
    interactionEnabled = false
    gsap.ticker.remove(tickerRender)
    visibilityObserver.disconnect()
    visuals.removeEventListener('pointermove', onPointerMove)
    visuals.removeEventListener('pointerleave', onPointerLeave)
    window.removeEventListener('resize', requestMeasure)
    if (measureFrame) cancelAnimationFrame(measureFrame)
    measureFrame = 0
    setActiveLine(-1, true)
    visuals.classList.remove('hipocampo-photo-text-ready')
  }

  const enableInteraction = () => {
    if (interactionEnabled || destroyed) return
    interactionEnabled = true
    heroVisible = true
    visuals.classList.add('hipocampo-photo-text-ready')
    measure()
    visibilityObserver.observe(scene)
    visuals.addEventListener('pointermove', onPointerMove, { passive: true })
    visuals.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', requestMeasure, { passive: true })
    gsap.ticker.add(tickerRender)
  }

  const syncInteractionAvailability = () => {
    const shouldEnable = (
      finePointer.matches
      && desktopViewport.matches
      && !reduceMotionRequested
    )

    if (shouldEnable) enableInteraction()
    else disableInteraction()
  }

  finePointer.addEventListener('change', syncInteractionAvailability)
  desktopViewport.addEventListener('change', syncInteractionAvailability)
  syncInteractionAvailability()

  if (document.readyState === 'complete') preloadPhotos()
  else window.addEventListener('load', preloadPhotos, { once: true })

  document.fonts?.ready.then(() => {
    if (!destroyed) requestMeasure()
  })

  const cleanup = () => {
    destroyed = true
    disableInteraction()
    moveParallax.tween?.kill()
    gsap.killTweensOf(parallax)
    layers.forEach((entry) => {
      entry.fadeTween?.kill()
      entry.zoomTween?.kill()
      gsap.killTweensOf(entry.layer)
      entry.line.classList.remove('hipocampo-photo-line-dimmed')
    })
    visuals.querySelectorAll('.hipocampo-photo-stripes-muted').forEach((node) => {
      node.classList.remove('hipocampo-photo-stripes-muted')
    })
    finePointer.removeEventListener('change', syncInteractionAvailability)
    desktopViewport.removeEventListener('change', syncInteractionAvailability)
    window.removeEventListener('load', preloadPhotos)
    window.removeEventListener('pagehide', cleanup)
    preloadedImages.length = 0
    overlay.remove()
    field.removeAttribute('data-photo-text-ready')
    delete window.__hipocampoHeroPhotoTextCleanup
  }

  window.__hipocampoHeroPhotoTextCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeHeroPhotoText()) {
  const bootObserver = new MutationObserver(() => {
    if (initializeHeroPhotoText()) bootObserver.disconnect()
  })
  bootObserver.observe(document.documentElement, { childList: true, subtree: true })
}
