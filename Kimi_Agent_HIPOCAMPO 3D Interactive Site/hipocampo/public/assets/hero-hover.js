import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'
import Lenis from './vendor/lenis.mjs'

const SCROLL_INTERACTION_LIMIT = 0.05
const LINE_OPACITIES = [0.96, 0.78, 0.62, 1, 0.86, 0.7, 0.56, 0.44]

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function createTextLens() {
  const lens = document.createElement('span')
  lens.className = 'hipocampo-memory-text-lens'
  lens.setAttribute('aria-hidden', 'true')
  return lens
}

function initializeHeroMemoryExperience() {
  const scene = document.querySelector('#abertura')
  const visuals = scene?.querySelector('.hipocampo-hero-visuals')
  const field = visuals?.querySelector('.hipocampo-memory-field')
  const lines = field ? [...field.querySelectorAll(':scope > span')].slice(0, 8) : []

  if (!scene || !visuals || !field || lines.length !== 8) return false
  if (field.dataset.memoryExperienceReady === 'true') return true

  window.__hipocampoHeroHoverCleanup?.()
  field.dataset.memoryExperienceReady = 'true'
  field.setAttribute('aria-hidden', 'true')

  const originalLines = lines.map((line) => ({
    line,
    className: line.className,
    style: line.getAttribute('style'),
  }))

  lines.forEach((line, index) => {
    line.classList.add('hipocampo-memory-line')
    line.style.setProperty('--memory-line-opacity', LINE_OPACITIES[index].toString())
  })

  const textLens = createTextLens()
  visuals.append(textLens)

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  let heroVisible = true
  let transitionActive = false
  let pointerVisible = false
  let lensActive = false
  let pointerX = window.innerWidth * 0.5
  let pointerY = window.innerHeight * 0.5
  let smoothX = pointerX
  let smoothY = pointerY
  let fieldRect = null
  let visualsRect = null
  let lineMetrics = []
  let lenis = null

  const measure = () => {
    fieldRect = field.getBoundingClientRect()
    visualsRect = visuals.getBoundingClientRect()
    lineMetrics = lines.map((line) => {
      const rect = line.getBoundingClientRect()
      return {
        center: rect.top + rect.height * 0.5,
        influenceRadius: Math.max(70, rect.height * 2.2),
      }
    })
  }

  const resetLines = () => {
    lines.forEach((line, index) => {
      line.style.setProperty('--memory-line-opacity', LINE_OPACITIES[index].toString())
    })
  }

  const hideLens = () => {
    if (!lensActive) return
    lensActive = false
    textLens.classList.remove('hipocampo-memory-text-lens-visible')
    resetLines()
  }

  const destroyLenis = () => {
    if (!lenis) return
    gsap.ticker.remove(lenisTicker)
    lenis.destroy()
    lenis = null
  }

  function lenisTicker(time) {
    lenis?.raf(time * 1000)
  }

  const setupLenis = () => {
    destroyLenis()
    if (!finePointer.matches || reducedMotion.matches) return

    // O Lenis atua apenas no wheel do desktop; toque e a instalação 3D permanecem nativos.
    lenis = new Lenis({
      anchors: true,
      autoRaf: false,
      duration: 1.08,
      smoothWheel: true,
      syncTouch: false,
      touchMultiplier: 1,
      wheelMultiplier: 0.92,
      prevent: (node) => (
        node instanceof Element
        && Boolean(node.closest('#instalacao canvas, [data-lenis-prevent], input, textarea, select'))
      ),
    })
    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(lenisTicker)
  }

  const syncMotionPreference = () => {
    hideLens()
    setupLenis()
  }

  const syncTransitionState = () => {
    const progress = Number.parseFloat(
      scene.style.getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0
    const nextState = progress > SCROLL_INTERACTION_LIMIT

    if (transitionActive === nextState) return
    transitionActive = nextState
    visuals.classList.toggle('hipocampo-memory-transitioning', transitionActive)
    if (transitionActive) hideLens()
  }

  const onPointerMove = (event) => {
    if (!finePointer.matches || reducedMotion.matches) return
    pointerX = event.clientX
    pointerY = event.clientY
    pointerVisible = true
  }

  const onPointerLeave = () => {
    pointerVisible = false
    hideLens()
  }

  const onResize = () => {
    measure()
    lenis?.resize()
  }

  const tickerRender = (_time, deltaMs) => {
    syncTransitionState()

    const deltaRatio = clamp((deltaMs || 16.67) / 16.67, 0.25, 4)
    const cursorEase = reducedMotion.matches ? 1 : 1 - Math.pow(0.8, deltaRatio)
    smoothX += (pointerX - smoothX) * cursorEase
    smoothY += (pointerY - smoothY) * cursorEase

    const insideField = Boolean(
      fieldRect
      && pointerX >= fieldRect.left
      && pointerX <= fieldRect.right
      && pointerY >= fieldRect.top
      && pointerY <= fieldRect.bottom,
    )
    const canInteract = (
      heroVisible
      && pointerVisible
      && finePointer.matches
      && !reducedMotion.matches
      && !transitionActive
      && insideField
    )

    if (!canInteract) {
      hideLens()
      return
    }

    textLens.style.transform = `translate3d(${(smoothX - visualsRect.left).toFixed(2)}px, ${(smoothY - visualsRect.top).toFixed(2)}px, 0) translate3d(-50%, -50%, 0)`

    if (!lensActive) {
      lensActive = true
      textLens.classList.add('hipocampo-memory-text-lens-visible')
    }

    lines.forEach((line, index) => {
      const { center, influenceRadius } = lineMetrics[index]
      const influence = clamp(1 - Math.abs(smoothY - center) / influenceRadius)
      const baseOpacity = LINE_OPACITIES[index]
      const highlightedOpacity = baseOpacity + (1 - baseOpacity) * influence
      line.style.setProperty('--memory-line-opacity', highlightedOpacity.toFixed(3))
    })
  }

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
    if (!heroVisible) hideLens()
  }, { rootMargin: '15% 0px' })
  visibilityObserver.observe(scene)

  visuals.classList.add('hipocampo-memory-experience')
  visuals.addEventListener('pointermove', onPointerMove, { passive: true })
  visuals.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('resize', onResize, { passive: true })
  finePointer.addEventListener('change', syncMotionPreference)
  reducedMotion.addEventListener('change', syncMotionPreference)
  gsap.ticker.add(tickerRender)

  document.fonts?.ready.then(() => {
    measure()
    ScrollTrigger.refresh()
  })
  measure()
  setupLenis()

  const cleanup = () => {
    gsap.ticker.remove(tickerRender)
    destroyLenis()
    visibilityObserver.disconnect()
    visuals.removeEventListener('pointermove', onPointerMove)
    visuals.removeEventListener('pointerleave', onPointerLeave)
    window.removeEventListener('resize', onResize)
    finePointer.removeEventListener('change', syncMotionPreference)
    reducedMotion.removeEventListener('change', syncMotionPreference)
    textLens.remove()
    visuals.classList.remove(
      'hipocampo-memory-experience',
      'hipocampo-memory-transitioning',
    )
    field.removeAttribute('data-memory-experience-ready')
    originalLines.forEach(({ line, className, style }) => {
      line.className = className
      if (style === null) line.removeAttribute('style')
      else line.setAttribute('style', style)
    })
    delete window.__hipocampoHeroHoverCleanup
  }

  window.__hipocampoHeroHoverCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeHeroMemoryExperience()) {
  const bootObserver = new MutationObserver(() => {
    if (initializeHeroMemoryExperience()) bootObserver.disconnect()
  })
  bootObserver.observe(document.documentElement, { childList: true, subtree: true })
}
