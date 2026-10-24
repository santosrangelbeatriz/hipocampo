import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'

const repeatLine = 'uma memória desapareceu uma memória desapareceu'
const transitionControllerId = 'hipocampo-figma-sticky-transition'

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function calculateCoverageScale(stage, circle) {
  const radius = Math.min(circle.offsetWidth, circle.offsetHeight) / 2

  if (!radius) {
    return 1
  }

  const centerX = circle.offsetLeft + radius
  const centerY = circle.offsetTop + radius
  const farthestCorner = Math.max(
    Math.hypot(centerX, centerY),
    Math.hypot(stage.clientWidth - centerX, centerY),
    Math.hypot(centerX, stage.clientHeight - centerY),
    Math.hypot(stage.clientWidth - centerX, stage.clientHeight - centerY),
  )

  return farthestCorner / radius
}

function stabilizeProjectSection(project) {
  const projectReveals = ScrollTrigger.getAll().filter((trigger) => (
    trigger.trigger === project
  ))

  projectReveals.forEach((trigger) => {
    trigger.animation?.kill()
    trigger.kill(true)
  })

  gsap.set(project, { clearProps: 'opacity,transform,translate,rotate,scale' })
}

function initializeScrollTransition(hero, stage, project) {
  const circle = stage.querySelector('.hipocampo-transition-circle')

  if (!circle) {
    return
  }

  window.__hipocampoHeroTransitionCleanup?.()
  stabilizeProjectSection(project)

  hero.dataset.transitionController = transitionControllerId
  hero.classList.add('hipocampo-transition-scene')
  project.classList.add('hipocampo-transition-project')

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const projectAnchors = [...document.querySelectorAll('a[href="#projeto"]')]
  let animationFrame = 0
  let coverageScale = 1
  let viewportWidth = 0
  let viewportHeight = 0

  const measure = () => {
    viewportWidth = window.innerWidth
    viewportHeight = window.innerHeight
    hero.style.setProperty('--hipocampo-viewport-height', `${viewportHeight}px`)
    project.style.setProperty('--hipocampo-viewport-height', `${viewportHeight}px`)

    const referenceFinalScale = viewportWidth <= 760 ? 21 : 19
    coverageScale = Math.max(referenceFinalScale, calculateCoverageScale(stage, circle))
  }

  const render = () => {
    animationFrame = 0

    if (reducedMotion.matches) {
      hero.style.setProperty('--hipocampo-scroll-progress', '0')
      project.style.setProperty('--hipocampo-scroll-progress', '0')
      circle.style.setProperty('--hipocampo-circle-scale', '1')
      project.style.setProperty('--hipocampo-reveal', '1')
      project.classList.add('hipocampo-transition-complete')
      stage.dataset.transitionPhase = 'reduced'
      return
    }

    const rect = hero.getBoundingClientRect()
    const scrollDistance = Math.max(1, hero.offsetHeight - window.innerHeight)
    const progress = clamp(-rect.top / scrollDistance)
    const reveal = clamp((progress - 0.54) * 2.18)
    const circleScale = 1 + progress * (coverageScale - 1)

    hero.style.setProperty('--hipocampo-scroll-progress', progress.toFixed(5))
    project.style.setProperty('--hipocampo-scroll-progress', progress.toFixed(5))
    circle.style.setProperty('--hipocampo-circle-scale', circleScale.toFixed(5))
    project.style.setProperty('--hipocampo-reveal', reveal.toFixed(5))

    const isComplete = progress >= 0.9999
    project.classList.toggle('hipocampo-transition-complete', isComplete)
    stage.dataset.transitionPhase = isComplete
      ? 'complete'
      : progress > 0
        ? 'expanding'
        : 'initial'
  }

  const requestRender = () => {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(render)
    }
  }

  const refresh = () => {
    if (
      window.innerWidth === viewportWidth
      && window.innerHeight === viewportHeight
    ) {
      requestRender()
      return
    }

    measure()
    requestRender()
  }

  const onMotionPreferenceChange = () => {
    measure()
    requestRender()
  }

  const scrollToProject = (event) => {
    if (
      reducedMotion.matches
      || event?.defaultPrevented
      || event?.button > 0
      || event?.metaKey
      || event?.ctrlKey
      || event?.shiftKey
      || event?.altKey
    ) {
      return
    }

    event?.preventDefault()

    const transitionEnd = hero.offsetTop + hero.offsetHeight - window.innerHeight
    window.scrollTo({
      top: transitionEnd,
      behavior: event ? 'smooth' : 'auto',
    })

    if (event && window.location.hash !== '#projeto') {
      window.history.pushState(null, '', '#projeto')
    }
  }

  measure()
  render()

  const stabilizationFrame = window.requestAnimationFrame(() => {
    stabilizeProjectSection(project)
    render()

    if (window.location.hash === '#projeto') {
      scrollToProject()
    }
  })

  window.addEventListener('scroll', requestRender, { passive: true })
  window.addEventListener('resize', refresh, { passive: true })
  window.visualViewport?.addEventListener('resize', refresh, { passive: true })
  reducedMotion.addEventListener('change', onMotionPreferenceChange)
  projectAnchors.forEach((anchor) => anchor.addEventListener('click', scrollToProject))

  const cleanup = () => {
    window.cancelAnimationFrame(animationFrame)
    window.cancelAnimationFrame(stabilizationFrame)
    window.removeEventListener('scroll', requestRender)
    window.removeEventListener('resize', refresh)
    window.visualViewport?.removeEventListener('resize', refresh)
    reducedMotion.removeEventListener('change', onMotionPreferenceChange)
    projectAnchors.forEach((anchor) => anchor.removeEventListener('click', scrollToProject))
    window.removeEventListener('pagehide', cleanup)
    hero.classList.remove('hipocampo-transition-scene')
    project.classList.remove(
      'hipocampo-transition-project',
      'hipocampo-transition-complete',
    )
    hero.style.removeProperty('--hipocampo-scroll-progress')
    hero.style.removeProperty('--hipocampo-viewport-height')
    project.style.removeProperty('--hipocampo-scroll-progress')
    project.style.removeProperty('--hipocampo-viewport-height')
    circle.style.removeProperty('--hipocampo-circle-scale')
    project.style.removeProperty('--hipocampo-reveal')
    delete stage.dataset.transitionPhase
    delete hero.dataset.transitionController
    delete window.__hipocampoHeroTransitionCleanup
  }

  window.__hipocampoHeroTransitionCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
}

function createHeroMarkup() {
  const stage = document.createElement('div')
  stage.className = 'hipocampo-hero-stage'
  stage.innerHTML = `
    <div class="hipocampo-hero-texture" aria-hidden="true"></div>
    <h1 class="hipocampo-hero-title">Uma memória desapareceu</h1>
    <div class="hipocampo-memory-field" aria-hidden="true">
      ${Array.from({ length: 8 }, () => `<span>${repeatLine}</span>`).join('')}
    </div>
    <div class="hipocampo-transition-circle" aria-hidden="true"></div>
  `
  return stage
}

function initializeHero() {
  const hero = document.querySelector('#abertura')
  const navigation = document.querySelector('body > #root > header')
  const project = document.querySelector('#projeto')

  if (!hero || !navigation || !project || hero.dataset.redesigned === 'true') {
    return false
  }

  hero.dataset.redesigned = 'true'
  hero.className = 'hipocampo-hero'
  const stage = createHeroMarkup()
  hero.replaceChildren(stage)

  const logo = navigation.querySelector(':scope > a')
  if (logo) {
    logo.textContent = 'Hipocampo'
  }

  navigation.classList.remove('hipocampo-nav-on-hero')
  navigation.classList.add('hipocampo-global-header')
  navigation.style.mixBlendMode = 'normal'
  initializeScrollTransition(hero, stage, project)
  return true
}

if (!initializeHero()) {
  const observer = new MutationObserver(() => {
    if (initializeHero()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
