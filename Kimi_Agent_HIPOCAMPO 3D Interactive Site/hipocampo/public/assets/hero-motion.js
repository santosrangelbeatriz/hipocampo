import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'
import Lenis from './vendor/lenis.mjs'

// Mude para true apenas se o projeto decidir respeitar a preferência do sistema.
// Com false, todas as animações pedidas rodam; se true, só a fuga das letras é desligada.
const RESPECT_REDUCED_MOTION = false
const POINTER_RADIUS = 140
const POINTER_PUSH = 40
const POINTER_BLUR_RADIUS = POINTER_RADIUS * 0.55
const MAX_BLUR = 8
const CIRCLE_RENDER_SCALE = 2

gsap.registerPlugin(ScrollTrigger)

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
)

function splitLineIntoCharacters(line) {
  const text = line.textContent || ''
  line.setAttribute('aria-label', text)
  line.replaceChildren()

  Array.from(text).forEach((character) => {
    const span = document.createElement('span')
    span.className = 'memory-char'
    span.style.display = 'inline-block'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = character === ' ' ? '\u00a0' : character
    line.append(span)
  })
}

function initializeHeroMotion() {
  const hero = document.querySelector('#abertura.hipocampo-hero')
  const field = hero?.querySelector('.hipocampo-memory-field')
  const circle = hero?.querySelector('.hipocampo-transition-circle')
  const header = document.querySelector('body > #root > header')
  const lines = field ? [...field.querySelectorAll(':scope > .hipocampo-memory-line')] : []

  if (!hero || !field || !circle || !header || lines.length !== 8) {
    return false
  }

  if (field.dataset.heroMotionReady === 'true') {
    return true
  }

  window.__hipocampoHeroMotionCleanup?.()
  window.__hipocampoHeroTransitionCleanup?.()
  field.dataset.heroMotionReady = 'true'

  const originalLines = lines.map((line) => ({
    line,
    html: line.innerHTML,
    ariaLabel: line.getAttribute('aria-label'),
  }))

  lines.forEach(splitLineIntoCharacters)
  const chars = lines.flatMap((line) => [...line.querySelectorAll('.memory-char')])
  const headerItems = [...header.children]
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const activeChars = new Set()
  let charCenters = []
  let pointerRenderPending = false
  let resizePending = false
  let pointerX = 0
  let pointerY = 0
  let pointerInside = false
  let transitionActive = false

  const canUsePointerEffect = () => (
    finePointer.matches
    && window.innerWidth >= 768
    && !(RESPECT_REDUCED_MOTION && reducedMotion.matches)
  )

  const measureCharCenters = () => {
    charCenters = chars.map((char) => {
      const rect = char.getBoundingClientRect()
      const translateX = Number.parseFloat(gsap.getProperty(char, 'x')) || 0
      const translateY = Number.parseFloat(gsap.getProperty(char, 'y')) || 0
      return {
        char,
        x: rect.left + rect.width / 2 - translateX,
        y: rect.top + rect.height / 2 - translateY,
      }
    })
  }

  const restoreCharacter = (char, elastic = false) => {
    gsap.to(char, {
      x: 0,
      y: 0,
      rotation: 0,
      filter: 'blur(0px)',
      opacity: 1,
      duration: elastic ? 1.2 : 0.6,
      ease: elastic ? 'elastic.out(1,0.5)' : 'power3.out',
      overwrite: 'auto',
      onComplete: () => { char.style.willChange = '' },
    })
  }

  const restoreAllCharacters = (elastic = false) => {
    activeChars.forEach((char) => restoreCharacter(char, elastic))
    activeChars.clear()
  }

  const renderPointerEffect = () => {
    pointerRenderPending = false
    gsap.ticker.remove(renderPointerEffect)

    if (!pointerInside || transitionActive || !canUsePointerEffect()) {
      restoreAllCharacters()
      return
    }

    const nextActive = new Set()

    charCenters.forEach(({ char, x, y }) => {
      const deltaX = x - pointerX
      const deltaY = y - pointerY
      const distanceSquared = deltaX * deltaX + deltaY * deltaY

      if (distanceSquared >= POINTER_RADIUS * POINTER_RADIUS) {
        if (activeChars.has(char)) {
          restoreCharacter(char)
        }
        return
      }

      const distance = Math.sqrt(distanceSquared)
      const influence = 1 - distance / POINTER_RADIUS
      const safeDistance = Math.max(distance, 0.001)
      const push = POINTER_PUSH * influence
      const xShift = deltaX / safeDistance * push
      const yShift = deltaY / safeDistance * push
      const rotation = clamp(xShift / POINTER_PUSH * 20, -20, 20)
      const blur = distance < POINTER_BLUR_RADIUS
        ? MAX_BLUR * (1 - distance / POINTER_BLUR_RADIUS)
        : 0

      nextActive.add(char)
      char.style.willChange = 'transform, opacity, filter'
      gsap.to(char, {
        x: xShift,
        y: yShift,
        rotation,
        filter: `blur(${blur.toFixed(2)}px)`,
        opacity: 1 - influence * 0.68,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    })

    activeChars.forEach((char) => {
      if (!nextActive.has(char)) {
        restoreCharacter(char)
      }
    })
    activeChars.clear()
    nextActive.forEach((char) => activeChars.add(char))
  }

  const requestPointerRender = () => {
    if (!pointerRenderPending) {
      pointerRenderPending = true
      gsap.ticker.add(renderPointerEffect)
    }
  }

  const onPointerMove = (event) => {
    if (!canUsePointerEffect()) {
      return
    }
    pointerX = event.clientX
    pointerY = event.clientY
    pointerInside = true
    requestPointerRender()
  }

  const onPointerLeave = () => {
    pointerInside = false
    pointerRenderPending = false
    gsap.ticker.remove(renderPointerEffect)
    restoreAllCharacters(true)
  }

  const resizeOnTicker = () => {
    resizePending = false
    gsap.ticker.remove(resizeOnTicker)
    measureCharCenters()
    lenis.resize()
    ScrollTrigger.refresh()
  }

  const onResize = () => {
    if (resizePending) return
    resizePending = true
    gsap.ticker.add(resizeOnTicker)
  }

  measureCharCenters()

  let transitionTimeline
  const ctx = gsap.context(() => {
    gsap.from(chars, {
      opacity: 0,
      y: 40,
      stagger: { each: 0.004, from: 'random' },
      duration: 1.4,
      ease: 'expo.out',
    })

    transitionTimeline = gsap.timeline({
      defaults: { overwrite: 'auto' },
      scrollTrigger: {
        id: 'hipocampo-page1-page2',
        trigger: hero,
        pin: true,
        scrub: 1,
        start: 'top top',
        end: '+=180%',
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          hero.style.setProperty('--hipocampo-scroll-progress', self.progress.toFixed(5))
          document.documentElement.classList.toggle(
            'hipocampo-transition-white',
            self.progress >= 0.92,
          )
          const nextTransitionActive = self.progress > 0.015
          if (nextTransitionActive && !transitionActive) {
            pointerInside = false
            restoreAllCharacters()
          }
          transitionActive = nextTransitionActive
        },
      },
    })

    transitionTimeline
      .to(lines, {
        y: (index) => {
          const direction = index < lines.length / 2 ? -1 : 1
          const distanceFromCenter = Math.abs(index - (lines.length - 1) / 2)
          return direction * (72 + distanceFromCenter * 18)
        },
        opacity: 0,
        filter: (index) => index % 2 === 0 ? `blur(${MAX_BLUR}px)` : 'blur(0px)',
        letterSpacing: '0.3em',
        duration: 0.58,
        ease: 'power2.in',
        stagger: { each: 0.04, from: 'center' },
      }, 0)
      .to(headerItems, {
        y: -80,
        opacity: 0,
        duration: 0.45,
        stagger: 0.025,
        ease: 'power2.in',
      }, 0.08)
      .to(circle, {
        yPercent: -60 / CIRCLE_RENDER_SCALE,
        scale: 18 / CIRCLE_RENDER_SCALE,
        backgroundColor: '#ffffff',
        duration: 1,
        ease: 'power2.inOut',
      }, 0.08)
  }, hero)

  const lenis = new Lenis({
    anchors: false,
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

  let lenisTickerActive = false
  let lenisTickerGraceFrames = 0
  const stopLenisTicker = () => {
    if (!lenisTickerActive) return
    gsap.ticker.remove(lenisTicker)
    lenisTickerActive = false
  }
  const lenisTicker = (time) => {
    lenis.raf(time * 1000)
    if (lenisTickerGraceFrames > 0) {
      lenisTickerGraceFrames -= 1
    } else if (!lenis.isScrolling) {
      stopLenisTicker()
    }
  }
  const startLenisTicker = () => {
    lenisTickerGraceFrames = 2
    if (lenisTickerActive) return
    lenisTickerActive = true
    gsap.ticker.add(lenisTicker)
  }
  const onLenisScroll = () => ScrollTrigger.update()
  lenis.on('scroll', onLenisScroll)
  lenis.on('virtual-scroll', startLenisTicker)
  gsap.ticker.lagSmoothing(0)
  window.__hipocampoLenis = lenis

  const menuAnchors = [...header.querySelectorAll('a[href^="#"]')]
  const main = document.querySelector('main')
  let activeAnchorTarget = null
  let anchorCorrectionPending = false

  const scrollToHash = (hash, immediate = false) => {
    const target = hash && hash !== '#'
      ? document.querySelector(hash)
      : document.documentElement

    if (!target) {
      return false
    }

    activeAnchorTarget = target
    startLenisTicker()
    lenis.scrollTo(target, {
      immediate,
      duration: immediate ? 0 : 1.2,
      offset: 0,
      onComplete: () => {
        lenis.resize()
        ScrollTrigger.refresh()
      },
    })
    return true
  }

  const onAnchorClick = (event) => {
    if (
      event.defaultPrevented
      || event.button > 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) {
      return
    }

    const hash = event.currentTarget.getAttribute('href')
    if (!hash || !scrollToHash(hash)) {
      return
    }

    event.preventDefault()
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash)
    }
  }

  const onHashChange = () => scrollToHash(window.location.hash)

  const clearAnchorLock = () => {
    activeAnchorTarget = null
  }

  const correctAnchorOnTicker = () => {
    anchorCorrectionPending = false
    gsap.ticker.remove(correctAnchorOnTicker)
    const distance = activeAnchorTarget?.getBoundingClientRect().top || 0
    if (Math.abs(distance) > 2) {
      lenis.scrollTo(activeAnchorTarget, { immediate: true, offset: 0 })
    }
  }

  const layoutObserver = new ResizeObserver(() => {
    lenis.resize()
    ScrollTrigger.refresh()

    if (!activeAnchorTarget || anchorCorrectionPending) {
      return
    }

    anchorCorrectionPending = true
    gsap.ticker.add(correctAnchorOnTicker)
  })

  if (main) {
    layoutObserver.observe(main)
  }

  field.addEventListener('pointermove', onPointerMove, { passive: true })
  field.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('wheel', clearAnchorLock, { passive: true })
  window.addEventListener('touchstart', clearAnchorLock, { passive: true })
  window.addEventListener('pointerdown', clearAnchorLock, { passive: true })
  window.addEventListener('keydown', clearAnchorLock)
  menuAnchors.forEach((anchor) => anchor.addEventListener('click', onAnchorClick))

  document.fonts?.ready.then(() => {
    measureCharCenters()
    lenis.resize()
    ScrollTrigger.refresh()

    if (window.location.hash) {
      scrollToHash(window.location.hash, true)
    }
  })

  const cleanup = () => {
    gsap.ticker.remove(renderPointerEffect)
    gsap.ticker.remove(resizeOnTicker)
    gsap.ticker.remove(correctAnchorOnTicker)
    restoreAllCharacters()
    layoutObserver.disconnect()
    field.removeEventListener('pointermove', onPointerMove)
    field.removeEventListener('pointerleave', onPointerLeave)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('hashchange', onHashChange)
    window.removeEventListener('wheel', clearAnchorLock)
    window.removeEventListener('touchstart', clearAnchorLock)
    window.removeEventListener('pointerdown', clearAnchorLock)
    window.removeEventListener('keydown', clearAnchorLock)
    window.removeEventListener('pagehide', cleanup)
    menuAnchors.forEach((anchor) => anchor.removeEventListener('click', onAnchorClick))
    lenis.off('scroll', onLenisScroll)
    lenis.off('virtual-scroll', startLenisTicker)
    stopLenisTicker()
    gsap.ticker.lagSmoothing(500, 33)
    lenis.destroy()
    transitionTimeline?.scrollTrigger?.kill()
    ctx.revert()
    hero.style.removeProperty('--hipocampo-scroll-progress')
    document.documentElement.classList.remove('hipocampo-transition-white')
    originalLines.forEach(({ line, html, ariaLabel }) => {
      line.innerHTML = html
      if (ariaLabel === null) line.removeAttribute('aria-label')
      else line.setAttribute('aria-label', ariaLabel)
    })
    delete field.dataset.heroMotionReady
    delete window.__hipocampoLenis
    delete window.__hipocampoHeroMotionCleanup
  }

  window.__hipocampoHeroMotionCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeHeroMotion()) {
  const observer = new MutationObserver(() => {
    if (initializeHeroMotion()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
