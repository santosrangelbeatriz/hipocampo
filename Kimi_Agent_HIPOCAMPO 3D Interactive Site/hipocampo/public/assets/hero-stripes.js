import { n as gsap } from './index-BXEErpTi.js'

const SCROLL_INTERACTION_LIMIT = 0.05
const STRIPE_CYCLE_SECONDS = 6
const STRIPE_PERIOD_EM = 1.05
const LENS_RADIUS_EM = 9

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function createStripesOverlay(lines) {
  const overlay = document.createElement('div')
  overlay.className = 'hipocampo-memory-stripes'
  overlay.setAttribute('aria-hidden', 'true')

  const layers = lines.map((line, index) => {
    const layer = document.createElement('span')
    layer.className = 'hipocampo-memory-stripes-layer'
    layer.dataset.stripesLine = String(index + 1)
    layer.textContent = line.textContent
    overlay.append(layer)

    return { line, layer, rect: null }
  })

  return { overlay, layers }
}

function initializeHeroStripes() {
  const scene = document.querySelector('#abertura')
  const visuals = scene?.querySelector('.hipocampo-hero-visuals')
  const field = visuals?.querySelector('.hipocampo-memory-field')
  const lines = field ? [...field.querySelectorAll(':scope > span')].slice(0, 8) : []

  if (!scene || !visuals || !field || lines.length !== 8) return false
  if (field.dataset.stripesReady === 'true') return true

  window.__hipocampoHeroStripesCleanup?.()
  field.dataset.stripesReady = 'true'

  const { overlay, layers } = createStripesOverlay(lines)
  visuals.append(overlay)

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const desktopViewport = window.matchMedia('(min-width: 768px)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const cursor = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
  }
  const moveCursorX = gsap.quickTo(cursor, 'x', {
    duration: 0.35,
    ease: 'power3.out',
  })
  const moveCursorY = gsap.quickTo(cursor, 'y', {
    duration: 0.35,
    ease: 'power3.out',
  })

  let visualsRect = null
  let heroVisible = true
  let transitionActive = false
  let pointerVisible = false
  let pointerX = cursor.x
  let pointerY = cursor.y
  let lastPointerX = pointerX
  let lastPointerY = pointerY
  let lastPointerTime = performance.now()
  let velocityTarget = 0
  let velocity = 0
  let stripeOffset = 0
  let stripePeriod = 48
  let lensRadius = 144
  let stripesVisible = false
  let visibilityTween = null
  let measureFrame = 0
  let interactionEnabled = false
  let destroyed = false

  const measure = () => {
    measureFrame = 0
    visualsRect = visuals.getBoundingClientRect()
    const fieldStyle = getComputedStyle(field)
    const fontSize = Number.parseFloat(fieldStyle.fontSize) || 16

    stripePeriod = fontSize * STRIPE_PERIOD_EM
    lensRadius = fontSize * LENS_RADIUS_EM

    layers.forEach(({ line, layer }, index) => {
      const rect = line.getBoundingClientRect()
      const x = rect.left - visualsRect.left
      const y = rect.top - visualsRect.top

      layers[index].rect = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }

      layer.style.width = `${rect.width}px`
      layer.style.height = `${rect.height}px`
      layer.style.fontFamily = fieldStyle.fontFamily
      layer.style.fontSize = fieldStyle.fontSize
      layer.style.fontWeight = fieldStyle.fontWeight
      layer.style.letterSpacing = fieldStyle.letterSpacing
      layer.style.lineHeight = fieldStyle.lineHeight
      layer.style.textAlign = fieldStyle.textAlign
      layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
      layer.style.setProperty('--mx', `${(pointerX - rect.left).toFixed(2)}px`)
      layer.style.setProperty('--my', `${(pointerY - rect.top).toFixed(2)}px`)
    })

    if (stripesVisible) overlay.style.setProperty('--r', `${lensRadius.toFixed(2)}px`)
  }

  const requestMeasure = () => {
    if (destroyed || !interactionEnabled || measureFrame) return
    measureFrame = requestAnimationFrame(measure)
  }

  const pointerTouchesText = () => layers.some(({ rect }) => (
    rect
    && pointerX >= rect.left
    && pointerX <= rect.right
    && pointerY >= rect.top
    && pointerY <= rect.bottom
  ))

  const canInteract = () => (
    interactionEnabled
    && heroVisible
    && pointerVisible
    && !transitionActive
    && pointerTouchesText()
  )

  const showStripes = () => {
    if (stripesVisible) return
    stripesVisible = true
    visibilityTween?.kill()
    overlay.style.visibility = 'visible'
    visibilityTween = gsap.to(overlay, {
      '--r': `${lensRadius.toFixed(2)}px`,
      opacity: 1,
      duration: 0.3,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }

  const hideStripes = (immediate = false) => {
    if (!stripesVisible && !immediate) return
    stripesVisible = false
    visibilityTween?.kill()

    if (immediate) {
      gsap.set(overlay, { '--r': '0px', opacity: 0 })
      overlay.style.visibility = 'hidden'
      return
    }

    visibilityTween = gsap.to(overlay, {
      '--r': '0px',
      opacity: 0,
      duration: 0.3,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => {
        if (!stripesVisible) overlay.style.visibility = 'hidden'
      },
    })
  }

  const syncTransitionState = () => {
    const progress = Number.parseFloat(
      scene.style.getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0
    const nextState = progress > SCROLL_INTERACTION_LIMIT

    if (transitionActive === nextState) return
    transitionActive = nextState
    if (transitionActive) hideStripes()
  }

  const onPointerMove = (event) => {
    const now = performance.now()
    const elapsed = Math.max(8, now - lastPointerTime)
    const distance = Math.hypot(
      event.clientX - lastPointerX,
      event.clientY - lastPointerY,
    )

    pointerX = event.clientX
    pointerY = event.clientY
    pointerVisible = true
    velocityTarget = clamp(distance / elapsed, 0, 3)
    lastPointerX = pointerX
    lastPointerY = pointerY
    lastPointerTime = now
    moveCursorX(pointerX)
    moveCursorY(pointerY)

    if (canInteract()) showStripes()
    else hideStripes()
  }

  const onPointerLeave = () => {
    pointerVisible = false
    velocityTarget = 0
    hideStripes()
  }

  const tickerRender = (_time, deltaMs) => {
    syncTransitionState()

    const deltaRatio = clamp((deltaMs || 16.67) / 16.67, 0.25, 4)
    velocity += (velocityTarget - velocity) * (1 - Math.pow(0.76, deltaRatio))
    velocityTarget *= Math.pow(0.84, deltaRatio)

    if (canInteract()) showStripes()
    else hideStripes()

    if (!stripesVisible || !visualsRect) return

    layers.forEach(({ layer, rect }) => {
      if (!rect) return
      layer.style.setProperty('--mx', `${(cursor.x - rect.left).toFixed(2)}px`)
      layer.style.setProperty('--my', `${(cursor.y - rect.top).toFixed(2)}px`)
    })

    const speedMultiplier = 1 + clamp(velocity * 2.2, 0, 5)
    const pixelsPerSecond = stripePeriod / STRIPE_CYCLE_SECONDS
    stripeOffset = (
      stripeOffset + pixelsPerSecond * speedMultiplier * (deltaMs / 1000)
    ) % stripePeriod
    overlay.style.setProperty('--stripes-offset', `${stripeOffset.toFixed(2)}px`)
  }

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
    if (!heroVisible) hideStripes()
  }, { rootMargin: '10% 0px' })

  const disableInteraction = () => {
    if (!interactionEnabled) return
    interactionEnabled = false
    pointerVisible = false
    velocityTarget = 0
    gsap.ticker.remove(tickerRender)
    visibilityObserver.disconnect()
    visuals.removeEventListener('pointermove', onPointerMove)
    visuals.removeEventListener('pointerleave', onPointerLeave)
    window.removeEventListener('resize', requestMeasure)
    if (measureFrame) cancelAnimationFrame(measureFrame)
    measureFrame = 0
    hideStripes(true)
  }

  const enableInteraction = () => {
    if (interactionEnabled || destroyed) return
    interactionEnabled = true
    heroVisible = true
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
      && !reducedMotion.matches
    )

    if (shouldEnable) enableInteraction()
    else disableInteraction()
  }

  finePointer.addEventListener('change', syncInteractionAvailability)
  desktopViewport.addEventListener('change', syncInteractionAvailability)
  reducedMotion.addEventListener('change', syncInteractionAvailability)
  syncInteractionAvailability()

  document.fonts?.ready.then(() => {
    if (!destroyed) requestMeasure()
  })

  const cleanup = () => {
    destroyed = true
    disableInteraction()
    moveCursorX.tween?.kill()
    moveCursorY.tween?.kill()
    visibilityTween?.kill()
    gsap.killTweensOf(overlay)
    finePointer.removeEventListener('change', syncInteractionAvailability)
    desktopViewport.removeEventListener('change', syncInteractionAvailability)
    reducedMotion.removeEventListener('change', syncInteractionAvailability)
    window.removeEventListener('pagehide', cleanup)
    if (measureFrame) cancelAnimationFrame(measureFrame)
    overlay.remove()
    field.removeAttribute('data-stripes-ready')
    delete window.__hipocampoHeroStripesCleanup
  }

  window.__hipocampoHeroStripesCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeHeroStripes()) {
  const bootObserver = new MutationObserver(() => {
    if (initializeHeroStripes()) bootObserver.disconnect()
  })
  bootObserver.observe(document.documentElement, { childList: true, subtree: true })
}
