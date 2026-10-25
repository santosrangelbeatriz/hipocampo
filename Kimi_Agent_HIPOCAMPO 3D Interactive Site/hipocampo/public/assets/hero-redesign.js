import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'

// Defina como true para voltar a respeitar a preferência de movimento reduzido do sistema.
const RESPECT_REDUCED_MOTION = true
const repeatLine = 'uma memória desapareceu uma memória desapareceu'
const transitionControllerId = 'hipocampo-figma-sticky-transition'
const minimumContinuationRatio = 0.3

const clamp = (value, minimum = 0, maximum = 1) => (
  Math.min(maximum, Math.max(minimum, value))
)

function calculateCoverageScale(stage, circle) {
  const radius = Math.min(circle.offsetWidth, circle.offsetHeight) / 2

  if (!radius) {
    return 1
  }

  const centerX = circle.offsetLeft
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

function initializeScrollTransition(scene, stage, project, originalProjectLocation) {
  const circle = stage.querySelector('.hipocampo-transition-circle')

  if (!circle) {
    return
  }

  window.__hipocampoHeroTransitionCleanup?.()
  stabilizeProjectSection(project)

  const continuation = document.createElement('div')
  continuation.className = 'hipocampo-project-continuation'
  continuation.setAttribute('aria-hidden', 'true')
  project.style.setProperty(
    '--hipocampo-project-color',
    window.getComputedStyle(project).color,
  )

  scene.dataset.transitionController = transitionControllerId
  scene.classList.add('hipocampo-transition-scene')
  project.classList.add('hipocampo-transition-project')
  stage.append(project)
  scene.after(continuation)

  const reducedMotion = RESPECT_REDUCED_MOTION
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : {
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }
  const syncReducedMotionClass = () => {
    document.documentElement.classList.toggle(
      'hipocampo-reduced-motion',
      reducedMotion.matches,
    )
  }
  syncReducedMotionClass()
  const projectAnchors = [...document.querySelectorAll('a[href="#projeto"]')]
  let animationFrame = 0
  let coverageScale = 1
  let sceneTop = 0
  let scrollDistance = 1
  let viewportWidth = 0
  let viewportHeight = 0
  let visualViewportHeight = 0
  let triggerRefreshFrame = 0

  const measure = () => {
    viewportWidth = window.innerWidth
    viewportHeight = window.innerHeight
    visualViewportHeight = window.visualViewport?.height || viewportHeight
    scene.style.setProperty('--hipocampo-viewport-height', `${viewportHeight}px`)
    project.style.setProperty('--hipocampo-viewport-height', `${viewportHeight}px`)

    sceneTop = window.scrollY + scene.getBoundingClientRect().top
    scrollDistance = Math.max(1, scene.offsetHeight - viewportHeight)

    const referenceInitialDiameterRatio = viewportWidth <= 760 ? 0.32 : 0.15
    const referenceFinalScale = viewportWidth <= 760 ? 21 : 19
    const referenceFinalDiameter = (
      viewportWidth * referenceInitialDiameterRatio * referenceFinalScale
    )
    const referenceTrajectoryScale = referenceFinalDiameter / circle.offsetWidth
    const cornerCoverageScale = calculateCoverageScale(stage, circle)
    coverageScale = Math.max(
      referenceTrajectoryScale,
      cornerCoverageScale * 1.01,
    )

    const projectHeight = Math.ceil(Math.max(
      project.scrollHeight,
      project.getBoundingClientRect().height,
    ))
    const continuationHeight = reducedMotion.matches
      ? projectHeight
      : Math.max(
          viewportHeight * minimumContinuationRatio,
          projectHeight - viewportHeight,
        )

    continuation.style.setProperty(
      '--hipocampo-project-continuation-height',
      `${Math.ceil(continuationHeight)}px`,
    )
  }

  const render = () => {
    animationFrame = 0

    if (reducedMotion.matches) {
      scene.style.setProperty('--hipocampo-scroll-progress', '0')
      project.style.setProperty('--hipocampo-scroll-progress', '0')
      circle.style.setProperty('--hipocampo-circle-scale', '1')
      project.style.setProperty('--hipocampo-reveal', '1')
      project.classList.add('hipocampo-project-visible')
      stage.dataset.transitionPhase = 'reduced'
      return
    }

    const progress = clamp((window.scrollY - sceneTop) / scrollDistance)
    const reveal = clamp((progress - 0.54) * 2.18)
    const circleScale = 1 + progress * (coverageScale - 1)

    scene.style.setProperty('--hipocampo-scroll-progress', progress.toFixed(5))
    project.style.setProperty('--hipocampo-scroll-progress', progress.toFixed(5))
    circle.style.setProperty('--hipocampo-circle-scale', circleScale.toFixed(5))
    project.style.setProperty('--hipocampo-reveal', reveal.toFixed(5))

    const isComplete = progress >= 0.9999
    project.classList.toggle('hipocampo-transition-complete', isComplete)
    project.classList.toggle('hipocampo-project-visible', reveal > 0)
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
      && (window.visualViewport?.height || window.innerHeight) === visualViewportHeight
    ) {
      requestRender()
      return
    }

    measure()
    requestRender()
    requestTriggerRefresh()
  }

  const onMotionPreferenceChange = () => {
    syncReducedMotionClass()
    measure()
    requestRender()
    requestTriggerRefresh()
  }

  const requestTriggerRefresh = () => {
    if (triggerRefreshFrame) {
      return
    }

    triggerRefreshFrame = window.requestAnimationFrame(() => {
      triggerRefreshFrame = 0
      ScrollTrigger.refresh()
    })
  }

  const scrollToProject = (event) => {
    if (
      event?.defaultPrevented
      || event?.button > 0
      || event?.metaKey
      || event?.ctrlKey
      || event?.shiftKey
      || event?.altKey
    ) {
      return
    }

    event?.preventDefault()

    const transitionEnd = reducedMotion.matches
      ? sceneTop + viewportHeight
      : sceneTop + scrollDistance
    window.scrollTo({
      top: transitionEnd,
      behavior: event && !reducedMotion.matches ? 'smooth' : 'auto',
    })

    if (event && window.location.hash !== '#projeto') {
      window.history.pushState(null, '', '#projeto')
    }
  }

  measure()
  render()

  const stabilizationFrame = window.requestAnimationFrame(() => {
    stabilizeProjectSection(project)
    measure()
    render()
    requestTriggerRefresh()

    if (window.location.hash === '#projeto') {
      scrollToProject()
    }
  })

  const projectResizeObserver = new ResizeObserver(() => {
    measure()
    requestRender()
    requestTriggerRefresh()
  })
  projectResizeObserver.observe(project)

  const onHashChange = () => {
    if (window.location.hash === '#projeto') {
      scrollToProject()
    }
  }

  window.addEventListener('scroll', requestRender, { passive: true })
  window.addEventListener('resize', refresh, { passive: true })
  window.visualViewport?.addEventListener('resize', refresh, { passive: true })
  window.addEventListener('hashchange', onHashChange)
  reducedMotion.addEventListener('change', onMotionPreferenceChange)
  projectAnchors.forEach((anchor) => anchor.addEventListener('click', scrollToProject))

  const cleanup = () => {
    window.cancelAnimationFrame(animationFrame)
    window.cancelAnimationFrame(stabilizationFrame)
    window.cancelAnimationFrame(triggerRefreshFrame)
    projectResizeObserver.disconnect()
    window.removeEventListener('scroll', requestRender)
    window.removeEventListener('resize', refresh)
    window.visualViewport?.removeEventListener('resize', refresh)
    window.removeEventListener('hashchange', onHashChange)
    reducedMotion.removeEventListener('change', onMotionPreferenceChange)
    projectAnchors.forEach((anchor) => anchor.removeEventListener('click', scrollToProject))
    window.removeEventListener('pagehide', cleanup)
    scene.classList.remove('hipocampo-transition-scene')
    project.classList.remove(
      'hipocampo-transition-project',
      'hipocampo-transition-complete',
      'hipocampo-project-visible',
    )
    scene.style.removeProperty('--hipocampo-scroll-progress')
    scene.style.removeProperty('--hipocampo-viewport-height')
    project.style.removeProperty('--hipocampo-scroll-progress')
    project.style.removeProperty('--hipocampo-viewport-height')
    project.style.removeProperty('--hipocampo-project-color')
    circle.style.removeProperty('--hipocampo-circle-scale')
    project.style.removeProperty('--hipocampo-reveal')
    continuation.remove()
    document.documentElement.classList.remove('hipocampo-reduced-motion')

    const { parent, nextSibling } = originalProjectLocation
    if (nextSibling?.parentNode === parent) {
      parent.insertBefore(project, nextSibling)
    } else {
      parent.append(project)
    }

    delete stage.dataset.transitionPhase
    delete scene.dataset.transitionController
    delete window.__hipocampoHeroTransitionCleanup
  }

  window.__hipocampoHeroTransitionCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
}

function createHeroMarkup() {
  const stage = document.createElement('div')
  stage.className = 'hipocampo-hero-stage'
  stage.innerHTML = `
    <h1 class="hipocampo-hero-title">Uma memória desapareceu</h1>
    <div class="hipocampo-hero-visuals">
      <div class="hipocampo-hero-texture" aria-hidden="true"></div>
      <div class="hipocampo-transition-circle" aria-hidden="true"></div>
      <div class="hipocampo-memory-field" aria-hidden="true">
        ${Array.from({ length: 8 }, () => `<span>${repeatLine}</span>`).join('')}
      </div>
    </div>
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
  const originalProjectLocation = {
    parent: project.parentNode,
    nextSibling: project.nextSibling,
  }
  const stage = createHeroMarkup()
  hero.replaceChildren(stage)

  const logo = navigation.querySelector(':scope > a')
  if (logo) {
    logo.textContent = 'Hipocampo'
  }

  navigation.classList.remove('hipocampo-nav-on-hero')
  navigation.classList.add('hipocampo-global-header')
  navigation.style.mixBlendMode = 'normal'
  initializeScrollTransition(hero, stage, project, originalProjectLocation)
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
