import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'
import Lenis from './vendor/lenis.mjs'
import { MemoryPhotoRenderer } from './hero-memory-webgl.js'

const MEMORY_PHOTO = '/images/hero/foto-01.webp'
const MEMORY_PHRASE = 'uma memória desapareceu'
const SCROLL_INTERACTION_LIMIT = 0.05
const LINE_OPACITIES = [0.96, 0.78, 0.62, 1, 0.86, 0.7, 0.56, 0.44]
const MARQUEE_DURATIONS = [27, 31, 25, 33, 28, 30, 26, 32]
const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function buildMarquee(line, index) {
  // Dois segmentos idênticos formam um ciclo contínuo sem recriar nós por frame.
  const track = document.createElement('span')
  track.className = 'hipocampo-memory-track'

  for (let copy = 0; copy < 2; copy += 1) {
    const segment = document.createElement('span')
    segment.className = 'hipocampo-memory-segment'
    segment.setAttribute('aria-hidden', 'true')

    for (let repetition = 0; repetition < 4; repetition += 1) {
      const phrase = document.createElement('span')
      phrase.className = 'hipocampo-memory-phrase'
      phrase.textContent = MEMORY_PHRASE
      segment.append(phrase)
    }

    track.append(segment)
  }

  line.replaceChildren(track)
  line.className = 'hipocampo-memory-line'
  line.dataset.memoryMarquee = 'true'
  line.style.setProperty('--memory-line-opacity', LINE_OPACITIES[index].toString())
  line.style.setProperty('--memory-line-index', index.toString())
  return track
}

function createPhoto() {
  const shell = document.createElement('div')
  const reveal = document.createElement('div')
  const inner = document.createElement('div')
  const fallback = document.createElement('img')
  const canvas = document.createElement('canvas')
  const caption = document.createElement('span')

  shell.className = 'hipocampo-memory-photo'
  shell.setAttribute('aria-hidden', 'true')
  reveal.className = 'hipocampo-memory-photo-reveal'
  inner.className = 'hipocampo-memory-photo-inner'
  fallback.className = 'hipocampo-memory-photo-fallback'
  fallback.src = MEMORY_PHOTO
  fallback.alt = ''
  fallback.decoding = 'async'
  fallback.draggable = false
  canvas.className = 'hipocampo-memory-photo-canvas'
  caption.className = 'hipocampo-memory-photo-caption'
  caption.textContent = 'aproxime para lembrar'

  inner.append(fallback, canvas, caption)
  reveal.append(inner)
  shell.append(reveal)
  return { shell, reveal, inner, canvas }
}

function createTrail() {
  // Os fragmentos são permanentes e reutilizados pelo mesmo ticker do GSAP.
  const trail = document.createElement('div')
  trail.className = 'hipocampo-memory-cursor-trail'
  trail.setAttribute('aria-hidden', 'true')
  const fragments = Array.from({ length: 4 }, (_, index) => {
    const fragment = document.createElement('span')
    fragment.style.setProperty('--trail-index', index.toString())
    trail.append(fragment)
    return fragment
  })
  document.body.append(trail)
  return { trail, fragments }
}

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
  const sourceLines = field ? [...field.querySelectorAll(':scope > span')].slice(0, 8) : []

  if (!scene || !visuals || !field || sourceLines.length !== 8) return false
  if (field.dataset.memoryExperienceReady === 'true') return true

  window.__hipocampoHeroHoverCleanup?.()
  field.dataset.memoryExperienceReady = 'true'
  field.setAttribute('aria-hidden', 'true')

  const originalLines = sourceLines.map((line) => ({
    line,
    className: line.className,
    html: line.innerHTML,
    style: line.getAttribute('style'),
  }))
  const tracks = sourceLines.map(buildMarquee)
  const { shell: photo, reveal: photoReveal, inner: photoInner, canvas } = createPhoto()
  const textLens = createTextLens()
  visuals.append(textLens, photo)
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const { trail, fragments } = createTrail()
  const fragmentPositions = fragments.map(() => ({ x: -120, y: -120 }))

  let heroVisible = true
  let transitionActive = false
  let lensActive = false
  let pointerVisible = false
  let touchPointerId = null
  let pointerX = window.innerWidth * 0.5
  let pointerY = window.innerHeight * 0.5
  let smoothX = pointerX
  let smoothY = pointerY
  let photoRect = null
  let fieldRect = null
  let visualsRect = null
  let lineCenters = []
  let tiltX = 0
  let tiltY = 0
  let tiltTargetX = 0
  let tiltTargetY = 0
  let scrollBoost = 0
  let scrollBoostTarget = 0
  let lastMarqueeScale = 1
  let lastWarpUpdate = Number.NEGATIVE_INFINITY
  let marquees = []
  let lenis = null
  let entranceTween = null

  const renderer = new MemoryPhotoRenderer(canvas, {
    imageUrl: MEMORY_PHOTO,
    reducedMotion: reducedMotion.matches,
    onReady: () => photo.classList.add('hipocampo-memory-photo-webgl-ready'),
    onUnavailable: () => photo.classList.remove('hipocampo-memory-photo-webgl-ready'),
  })

  const measure = () => {
    photoRect = photo.getBoundingClientRect()
    fieldRect = field.getBoundingClientRect()
    visualsRect = visuals.getBoundingClientRect()
    lineCenters = sourceLines.map((line) => {
      const rect = line.getBoundingClientRect()
      return rect.top + rect.height * 0.5
    })
  }

  const setupMarquees = () => {
    marquees.forEach((tween) => tween.kill())
    marquees = []

    tracks.forEach((track, index) => {
      const startsAtHalf = index % 2 === 1
      if (reducedMotion.matches) {
        gsap.set(track, { xPercent: startsAtHalf ? -50 : 0 })
        return
      }

      const tween = gsap.fromTo(
        track,
        { xPercent: startsAtHalf ? -50 : 0 },
        {
          xPercent: startsAtHalf ? 0 : -50,
          duration: MARQUEE_DURATIONS[index],
          ease: 'none',
          repeat: -1,
        },
      )
      marquees.push(tween)
    })
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

    // Lenis suaviza somente o wheel no desktop; touch e a instalação 3D ficam nativos.
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

  const setupEntrance = () => {
    entranceTween?.kill()
    if (reducedMotion.matches) {
      gsap.set(photoReveal, { autoAlpha: 1, filter: 'none', scale: 1, yPercent: 0 })
      return
    }

    entranceTween = gsap.fromTo(
      photoReveal,
      { autoAlpha: 0, filter: 'blur(18px)', scale: 0.84, yPercent: 8 },
      {
        autoAlpha: 1,
        filter: 'blur(0px)',
        scale: 1,
        yPercent: 0,
        duration: 1.25,
        delay: 0.18,
        ease: 'power3.out',
        onComplete: () => gsap.set(photoReveal, { clearProps: 'filter' }),
      },
    )
  }

  const syncMotionPreference = () => {
    visuals.classList.toggle('hipocampo-memory-reduced-motion', reducedMotion.matches)
    renderer.setReducedMotion(reducedMotion.matches)
    setupMarquees()
    setupLenis()
    setupEntrance()
  }

  const syncTransitionState = () => {
    const progress = Number.parseFloat(
      scene.style.getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0
    const nextState = progress > SCROLL_INTERACTION_LIMIT
    if (transitionActive === nextState) return
    transitionActive = nextState
    visuals.classList.toggle('hipocampo-memory-transitioning', transitionActive)
    if (transitionActive) {
      renderer.clearPointer()
      tiltTargetX = 0
      tiltTargetY = 0
    }
  }

  const updatePointerTargets = (clientX, clientY) => {
    pointerX = clientX
    pointerY = clientY
    pointerVisible = true
    if (!photoRect) measure()

    const insidePhoto = photoRect
      && clientX >= photoRect.left
      && clientX <= photoRect.right
      && clientY >= photoRect.top
      && clientY <= photoRect.bottom

    if (insidePhoto && !transitionActive) {
      const normalizedX = ((clientX - photoRect.left) / photoRect.width) * 2 - 1
      const normalizedY = ((clientY - photoRect.top) / photoRect.height) * 2 - 1
      tiltTargetX = -normalizedY * 6.2
      tiltTargetY = normalizedX * 7.4
      renderer.setPointer(clientX, clientY, true, 1, photoRect)
      photo.classList.add('hipocampo-memory-photo-active')
    } else {
      tiltTargetX = 0
      tiltTargetY = 0
      renderer.clearPointer()
      photo.classList.remove('hipocampo-memory-photo-active')
    }
  }

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') {
      if (event.pointerId === touchPointerId) updatePointerTargets(event.clientX, event.clientY)
      return
    }
    if (!finePointer.matches) return
    updatePointerTargets(event.clientX, event.clientY)
  }

  const onPointerLeave = () => {
    pointerVisible = false
    renderer.clearPointer()
    photo.classList.remove('hipocampo-memory-photo-active')
    tiltTargetX = 0
    tiltTargetY = 0
  }

  const onPhotoPointerDown = (event) => {
    if (event.pointerType !== 'touch') return
    touchPointerId = event.pointerId
    updatePointerTargets(event.clientX, event.clientY)
  }

  const onPhotoPointerMove = (event) => {
    if (event.pointerType === 'touch' && event.pointerId === touchPointerId) {
      updatePointerTargets(event.clientX, event.clientY)
    }
  }

  const onPhotoPointerEnd = (event) => {
    if (event.pointerId !== touchPointerId) return
    touchPointerId = null
    renderer.clearPointer()
    photo.classList.remove('hipocampo-memory-photo-active')
  }

  const onResize = () => {
    measure()
    renderer.resize()
    lenis?.resize()
  }

  const tickerRender = (time, deltaMs) => {
    // Um único loop atualiza cursor, tilt, lente tipográfica e shader via transform/opacity.
    syncTransitionState()
    const deltaRatio = clamp((deltaMs || 16.67) / 16.67, 0.25, 4)
    const cursorEase = 1 - Math.pow(0.82, deltaRatio)
    const tiltEase = 1 - Math.pow(0.86, deltaRatio)

    smoothX += (pointerX - smoothX) * cursorEase
    smoothY += (pointerY - smoothY) * cursorEase
    tiltX += (tiltTargetX - tiltX) * tiltEase
    tiltY += (tiltTargetY - tiltY) * tiltEase
    scrollBoost += (scrollBoostTarget - scrollBoost) * (1 - Math.pow(0.88, deltaRatio))
    scrollBoostTarget *= Math.pow(0.91, deltaRatio)

    if (!reducedMotion.matches) {
      const marqueeScale = 1 + scrollBoost
      if (Math.abs(marqueeScale - lastMarqueeScale) > 0.01) {
        marquees.forEach((tween) => tween.timeScale(marqueeScale))
        lastMarqueeScale = marqueeScale
      }
      photoInner.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg)`
      photoInner.style.setProperty('--memory-parallax-x', `${(tiltY * 0.12).toFixed(3)}px`)
      photoInner.style.setProperty('--memory-parallax-y', `${(-tiltX * 0.12).toFixed(3)}px`)
    }

    if (fieldRect && finePointer.matches && pointerVisible && !transitionActive) {
      textLens.style.transform = `translate3d(${(smoothX - visualsRect.left).toFixed(2)}px, ${(smoothY - visualsRect.top).toFixed(2)}px, 0) translate3d(-50%, -50%, 0)`
      if (!lensActive) {
        lensActive = true
        textLens.classList.add('hipocampo-memory-text-lens-visible')
      }
      if (time - lastWarpUpdate >= 1 / 24) {
        lastWarpUpdate = time
        sourceLines.forEach((line, index) => {
          const distance = Math.abs(smoothY - lineCenters[index])
          const influence = clamp(1 - distance / 92)
          const direction = index % 2 === 0 ? 1 : -1
          line.style.setProperty('--memory-warp-x', `${(influence * direction * 7).toFixed(3)}px`)
          line.style.setProperty('--memory-warp-skew', `${(influence * direction * 1.4).toFixed(3)}deg`)
        })
      }
    } else if (lensActive) {
      lensActive = false
      textLens.classList.remove('hipocampo-memory-text-lens-visible')
      sourceLines.forEach((line) => {
        line.style.setProperty('--memory-warp-x', '0px')
        line.style.setProperty('--memory-warp-skew', '0deg')
      })
    }

    let trailX = smoothX
    let trailY = smoothY
    fragments.forEach((fragment, index) => {
      const point = fragmentPositions[index]
      const ease = 0.28 - index * 0.025
      point.x += (trailX - point.x) * ease
      point.y += (trailY - point.y) * ease
      trailX = point.x
      trailY = point.y
      fragment.style.transform = `translate3d(${point.x.toFixed(2)}px, ${point.y.toFixed(2)}px, 0) rotate(${(index % 2 ? -1 : 1) * (index + 1) * 7}deg)`
    })
    trail.classList.toggle(
      'hipocampo-memory-cursor-trail-visible',
      finePointer.matches && pointerVisible && heroVisible && !transitionActive && !reducedMotion.matches,
    )

    if (heroVisible && !transitionActive) {
      const motion = reducedMotion.matches ? 0 : clamp(Math.abs(tiltX) + Math.abs(tiltY), 0, 8) / 8
      renderer.render(time * 1000, deltaMs || 16.67, Math.max(0.35, motion))
    }
  }

  const speedTrigger = ScrollTrigger.create({
    trigger: scene,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: (self) => {
      if (!reducedMotion.matches) {
        scrollBoostTarget = clamp(Math.abs(self.getVelocity()) / 1150, 0, 2.4)
      }
    },
  })

  const visibilityObserver = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
    if (!heroVisible) trail.classList.remove('hipocampo-memory-cursor-trail-visible')
  }, { rootMargin: '15% 0px' })
  visibilityObserver.observe(scene)

  visuals.classList.add('hipocampo-memory-experience')
  visuals.addEventListener('pointermove', onPointerMove, { passive: true })
  visuals.addEventListener('pointerleave', onPointerLeave)
  photo.addEventListener('pointerdown', onPhotoPointerDown, { passive: true })
  photo.addEventListener('pointermove', onPhotoPointerMove, { passive: true })
  photo.addEventListener('pointerup', onPhotoPointerEnd, { passive: true })
  photo.addEventListener('pointercancel', onPhotoPointerEnd, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })
  finePointer.addEventListener('change', syncMotionPreference)
  reducedMotion.addEventListener('change', syncMotionPreference)
  gsap.ticker.add(tickerRender)

  document.fonts?.ready.then(() => {
    measure()
    ScrollTrigger.refresh()
  })
  measure()
  syncMotionPreference()

  const cleanup = () => {
    gsap.ticker.remove(tickerRender)
    destroyLenis()
    entranceTween?.kill()
    marquees.forEach((tween) => tween.kill())
    speedTrigger.kill()
    visibilityObserver.disconnect()
    renderer.destroy()
    visuals.removeEventListener('pointermove', onPointerMove)
    visuals.removeEventListener('pointerleave', onPointerLeave)
    photo.removeEventListener('pointerdown', onPhotoPointerDown)
    photo.removeEventListener('pointermove', onPhotoPointerMove)
    photo.removeEventListener('pointerup', onPhotoPointerEnd)
    photo.removeEventListener('pointercancel', onPhotoPointerEnd)
    window.removeEventListener('resize', onResize)
    finePointer.removeEventListener('change', syncMotionPreference)
    reducedMotion.removeEventListener('change', syncMotionPreference)
    photo.remove()
    textLens.remove()
    trail.remove()
    visuals.classList.remove(
      'hipocampo-memory-experience',
      'hipocampo-memory-transitioning',
      'hipocampo-memory-reduced-motion',
    )
    field.removeAttribute('data-memory-experience-ready')
    originalLines.forEach(({ line, className, html, style }) => {
      line.className = className
      line.innerHTML = html
      if (style === null) line.removeAttribute('style')
      else line.setAttribute('style', style)
      line.removeAttribute('data-memory-marquee')
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
