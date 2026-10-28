import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'

gsap.registerPlugin(ScrollTrigger)

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)')

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value))

/**
 * Envole cada linha (separada por <br>) de um título em contêineres de máscara
 * para animações tipográficas sincronizadas ao scroll sem alterar texto nem semântica.
 */
function prepareEditorialHeading(heading) {
  if (!heading || heading.dataset.hipSplit === 'true') {
    return null
  }

  const originalNodes = [...heading.childNodes].map((node) => node.cloneNode(true))
  const lines = []
  let currentLine = []

  heading.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      lines.push(currentLine)
      currentLine = []
    } else {
      currentLine.push(node.cloneNode(true))
    }
  })

  if (currentLine.length > 0) {
    lines.push(currentLine)
  }

  if (lines.length === 0) {
    return null
  }

  heading.dataset.hipSplit = 'true'
  const fragment = document.createDocumentFragment()
  const innerSpans = []

  lines.forEach((lineNodes, index) => {
    const lineWrapper = document.createElement('span')
    lineWrapper.className = 'hip-split-line'

    const lineInner = document.createElement('span')
    lineInner.className = 'hip-split-inner'
    lineNodes.forEach((child) => lineInner.append(child))

    lineWrapper.append(lineInner)
    fragment.append(lineWrapper)
    innerSpans.push(lineInner)

    if (index < lines.length - 1) {
      fragment.append(document.createElement('br'))
    }
  })

  heading.replaceChildren(fragment)

  return {
    innerSpans,
    revert() {
      heading.replaceChildren(...originalNodes.map((node) => node.cloneNode(true)))
      delete heading.dataset.hipSplit
    },
  }
}

/**
 * Remove os triggers legados genéricos de entrada única (play none none none)
 * das seções inferiores para substituí-los por animações editoriais reversíveis
 * e sincronizadas ao scroll, sem conflito de loops ou propriedades.
 */
function clearLegacySectionTriggers(sections) {
  const sectionSet = new Set(sections.filter(Boolean))
  const processSlides = new Set(document.querySelectorAll('#oficina .process-slide'))

  ScrollTrigger.getAll().forEach((trigger) => {
    if (sectionSet.has(trigger.trigger) || processSlides.has(trigger.trigger)) {
      trigger.animation?.kill()
      trigger.kill(true)
    }
  })

  sections.forEach((section) => {
    if (section) {
      gsap.set(section, { clearProps: 'opacity,transform,translate,rotate,scale' })
    }
  })
}

function clearLateLegacyTriggers(sections) {
  const sectionSet = new Set(sections.filter(Boolean))
  let killed = 0

  ScrollTrigger.getAll().forEach((trigger) => {
    if (
      sectionSet.has(trigger.trigger)
      && trigger.vars?.toggleActions === 'play none none none'
    ) {
      trigger.animation?.kill()
      trigger.kill(true)
      killed += 1
    }
  })

  return killed
}

function initializeEditorialRedesign() {
  const root = document.querySelector('#root')
  const header = document.querySelector('body > #root > header')
  const hero = document.querySelector('#abertura')
  const projeto = document.querySelector('#projeto')
  const oficina = document.querySelector('#oficina')
  const instalacao = document.querySelector('#instalacao')
  const fragmentos = document.querySelector('#fragmentos')
  const fotofilmes = document.querySelector('#fotofilmes')
  const informacoes = document.querySelector('#informacoes')
  const footer = document.querySelector('body > #root > footer')

  if (
    !root
    || !header
    || !hero
    || !projeto
    || !oficina
    || !fragmentos
    || !fotofilmes
    || !informacoes
    || !hero.querySelector('.hipocampo-memory-field')
  ) {
    return false
  }

  if (document.documentElement.dataset.editorialMotionReady === 'true') {
    return true
  }

  window.__hipocampoEditorialCleanup?.()
  document.documentElement.dataset.editorialMotionReady = 'true'

  const splitRecords = []
  const magneticCleanups = []

  // 1. Barra de progresso de leitura no topo da viewport
  const progressBar = document.createElement('div')
  progressBar.className = 'hipocampo-scroll-progress-bar'
  progressBar.setAttribute('aria-hidden', 'true')
  const progressFill = document.createElement('div')
  progressFill.className = 'hipocampo-scroll-progress-fill'
  progressBar.append(progressFill)
  document.body.append(progressBar)

  // 2. Limpar triggers antigos conflitantes nas seções pós-hero
  const managedSections = [oficina, instalacao, fragmentos, fotofilmes, informacoes].filter(Boolean)
  clearLegacySectionTriggers(managedSections)

  let lateLegacyTimer = 0
  const clearLateLegacyOnce = () => {
    window.clearTimeout(lateLegacyTimer)
    lateLegacyTimer = window.setTimeout(() => {
      const mountedInstallation = document.querySelector('#instalacao')
      clearLateLegacyTriggers([projeto, ...managedSections, mountedInstallation])
      if (mountedInstallation) lateLegacyObserver.disconnect()
    }, 180)
  }
  const lateLegacyObserver = new MutationObserver(clearLateLegacyOnce)
  lateLegacyObserver.observe(root, { childList: true, subtree: true })
  clearLateLegacyOnce()

  // 3. Construir contexto GSAP reversível (respeitando prefers-reduced-motion)
  let gsapCtx = null

  const setupScrollAnimations = () => {
    gsapCtx?.revert()
    splitRecords.splice(0).forEach((record) => record.revert())

    if (reducedMotionQuery.matches) {
      return
    }

    gsapCtx = gsap.context(() => {
      // Preparar e animar títulos e cabeçalhos editoriais nas seções
      const narrativeSections = [
        oficina,
        instalacao,
        fragmentos,
        fotofilmes,
        informacoes,
      ].filter(Boolean)

      narrativeSections.forEach((section) => {
        const headings = section.querySelectorAll('h2, h3')

        headings.forEach((heading) => {
          // Na seção fotofilmes, h3 do Fotofilme A possui posicionamento absoluto delicado; animamos suas linhas internas
          const record = prepareEditorialHeading(heading)
          if (record) {
            splitRecords.push(record)
            gsap.fromTo(
              record.innerSpans,
              {
                yPercent: 108,
                opacity: 0,
              },
              {
                yPercent: 0,
                opacity: 1,
                duration: 0.95,
                stagger: 0.09,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: heading,
                  start: 'top 88%',
                  end: 'top 35%',
                  toggleActions: 'play none none reverse',
                },
              },
            )
          }
        })

        // Eyebrow ("02 — Como funciona", etc.)
        const eyebrow = section.querySelector('.eyebrow')
        if (eyebrow) {
          gsap.fromTo(
            eyebrow,
            { opacity: 0, x: -18 },
            {
              opacity: 1,
              x: 0,
              duration: 0.75,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: eyebrow,
                start: 'top 90%',
                toggleActions: 'play none none reverse',
              },
            },
          )
        }

        // Parágrafos editoriais e notas manuscritas (.script)
        const copyNodes = section.querySelectorAll(
          ':scope > div > p:not(.eyebrow), :scope > div > div > p, :scope > article p, :scope > p.script, :scope > div.script',
        )
        copyNodes.forEach((paragraph, idx) => {
          paragraph.classList.add('hip-editorial-paragraph')
          gsap.fromTo(
            paragraph,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.82,
              delay: Math.min(idx * 0.04, 0.2),
              ease: 'power3.out',
              scrollTrigger: {
                trigger: paragraph,
                start: 'top 90%',
                toggleActions: 'play none none reverse',
              },
            },
          )
        })
      })

      // Seção 02 — Oficina: cartões de processo com entrada reversível e parallax sutil
      const processSlides = gsap.utils.toArray('#oficina .process-slide')
      processSlides.forEach((slide, index) => {
        const baseRotations = [-4, 3, 2, -5]
        const targetRotation = baseRotations[index] ?? 0
        const startRotation = index % 2 === 0 ? targetRotation - 6 : targetRotation + 6

        gsap.fromTo(
          slide,
          {
            opacity: 0,
            y: 56,
            rotation: startRotation,
          },
          {
            opacity: 1,
            y: 0,
            rotation: targetRotation,
            duration: 0.95,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: slide,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          },
        )

        const slideImg = slide.querySelector('img')
        if (slideImg) {
          slideImg.parentElement?.classList.add('hip-image-reveal')
          gsap.fromTo(
            slideImg,
            { scale: 1.12 },
            {
              scale: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: slide,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          )
        }
      })

      // Seção 04 — Espaço dos fragmentos: entrada progressiva do quadro de montagem
      const fragmentBoard = fragmentos.querySelector(':scope > div:nth-child(2)')
      if (fragmentBoard) {
        gsap.fromTo(
          fragmentBoard,
          { opacity: 0, y: 36 },
          {
            opacity: 1,
            y: 0,
            duration: 0.95,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: fragmentBoard,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          },
        )
      }

      // Seção 05 — Fotofilmes: revelação progressiva dos quadros de projeção
      const filmArticles = gsap.utils.toArray('#fotofilmes article')
      filmArticles.forEach((article) => {
        const frame = article.querySelector(':scope > div:nth-child(2), :scope > div.md\\:order-1')
        if (frame) {
          gsap.fromTo(
            frame,
            {
              opacity: 0,
              y: 42,
              clipPath: 'inset(8% 4% 8% 4%)',
            },
            {
              opacity: 1,
              y: 0,
              clipPath: 'inset(0% 0% 0% 0%)',
              duration: 1.05,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: article,
                start: 'top 84%',
                toggleActions: 'play none none reverse',
              },
            },
          )
        }
      })

      // Seção 06 — Informações: revelação escalonada reversível das linhas de dados
      const infoRows = gsap.utils.toArray('#informacoes dl > div')
      if (infoRows.length) {
        gsap.fromTo(
          infoRows,
          { opacity: 0, y: 22 },
          {
            opacity: 1,
            y: 0,
            duration: 0.72,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: informacoes.querySelector('dl'),
              start: 'top 86%',
              toggleActions: 'play none none reverse',
            },
          },
        )
      }
    })

    ScrollTrigger.refresh()
  }

  setupScrollAnimations()

  // Observar quando a seção #instalacao (lazy loaded) montar no DOM para integrá-la sem conflitos
  let instalacaoConfigured = !!document.querySelector('#instalacao')
  const instalacaoObserver = new MutationObserver(() => {
    const inst = document.querySelector('#instalacao')
    if (inst && !instalacaoConfigured) {
      instalacaoConfigured = true
      clearLegacySectionTriggers([inst])
      setupScrollAnimations()
      window.requestAnimationFrame(measureSectionRanges)
    }
  })
  instalacaoObserver.observe(root, { childList: true, subtree: true })

  // 5. Sincronização de navegação ativa, tema do cabeçalho e barra de progresso
  const navLinks = [...header.querySelectorAll('nav a[href^="#"]')]
  const sectionThemeMap = [
    { id: 'abertura', theme: 'dark', cursorTheme: 'on-blue' },
    { id: 'projeto', theme: 'yellow', cursorTheme: 'on-yellow' },
    { id: 'oficina', theme: 'dark', cursorTheme: 'on-brown' },
    { id: 'instalacao', theme: 'dark', cursorTheme: 'on-dark' },
    { id: 'fragmentos', theme: 'light', cursorTheme: 'on-paper' },
    { id: 'fotofilmes', theme: 'dark', cursorTheme: 'on-blue' },
    { id: 'informacoes', theme: 'yellow', cursorTheme: 'on-yellow' },
  ]

  let currentCursorTheme = 'on-blue'
  let currentActiveId = ''
  let currentHeaderTheme = ''
  let currentHeaderScrolled = null
  let currentPageProgress = ''
  let sectionRanges = []
  let maxPageScroll = 1

  const measureSectionRanges = () => {
    maxPageScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    sectionRanges = sectionThemeMap.map((item) => {
      const element = document.getElementById(item.id)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      const top = rect.top + window.scrollY
      return { ...item, element, top, bottom: top + rect.height }
    }).filter(Boolean)
  }

  const updateScrollNavigation = () => {
    const scrollY = window.scrollY
    const pageProgress = clamp(scrollY / maxPageScroll, 0, 1)
    const nextPageProgress = pageProgress.toFixed(4)
    if (nextPageProgress !== currentPageProgress) {
      currentPageProgress = nextPageProgress
      progressFill.style.setProperty('--hip-page-progress', nextPageProgress)
    }

    const nextHeaderScrolled = scrollY > 72
    if (nextHeaderScrolled !== currentHeaderScrolled) {
      currentHeaderScrolled = nextHeaderScrolled
      header.classList.toggle('hipocampo-header-scrolled', nextHeaderScrolled)
    }

    const probeY = scrollY + window.innerHeight * 0.28
    let activeId = 'abertura'
    let activeTheme = 'dark'
    let activeCursorTheme = 'on-blue'

    const heroProgress = Number.parseFloat(
      hero.dataset.hipocampoScrollProgress,
    ) || 0

    for (const item of sectionRanges) {
      if (item.id === 'projeto' && item.element.classList.contains('hipocampo-transition-project')) {
        if (heroProgress >= 0.48) {
          activeId = 'projeto'
          activeTheme = item.theme
          activeCursorTheme = item.cursorTheme
        }
        continue
      }

      if (item.top <= probeY && item.bottom >= probeY) {
        if (item.id === 'abertura' && heroProgress >= 0.48) {
          activeId = 'projeto'
          activeTheme = 'yellow'
          activeCursorTheme = 'on-yellow'
        } else {
          activeId = item.id
          activeTheme = item.theme
          activeCursorTheme = item.cursorTheme
        }
      }
    }

    if (activeTheme !== currentHeaderTheme) {
      currentHeaderTheme = activeTheme
      header.dataset.navTheme = activeTheme
    }

    if (activeCursorTheme !== currentCursorTheme) {
      currentCursorTheme = activeCursorTheme
      if (cursorEl) cursorEl.dataset.cursorTheme = currentCursorTheme
    }

    if (activeId !== currentActiveId) {
      currentActiveId = activeId
      navLinks.forEach((link) => {
        const targetId = link.getAttribute('href')?.slice(1)
        link.classList.toggle('is-active-section', targetId === activeId)
      })
    }
  }

  // 6. Cursor contextual com suavização (acoplado ao gsap.ticker para evitar loops rAF duplicados)
  let cursorEl = null
  let cursorLabel = null
  let pointerX = -100
  let pointerY = -100
  let smoothX = -100
  let smoothY = -100
  let cursorVisible = false
  let cursorTickerActive = false

  if (finePointerQuery.matches && !reducedMotionQuery.matches) {
    cursorEl = document.createElement('div')
    cursorEl.className = 'hipocampo-editorial-cursor'
    cursorEl.setAttribute('aria-hidden', 'true')
    cursorEl.dataset.cursorTheme = 'on-blue'
    cursorEl.dataset.cursorMode = 'default'

    const dot = document.createElement('span')
    dot.className = 'hipocampo-editorial-cursor-dot'
    cursorLabel = document.createElement('span')
    cursorLabel.className = 'hipocampo-editorial-cursor-label'
    cursorEl.append(dot, cursorLabel)
    document.body.append(cursorEl)
  }

  const resolveCursorContext = (target) => {
    if (!target || !(target instanceof Element)) {
      return { mode: 'default', label: '' }
    }

    if (target.closest('.hipocampo-hero-visuals')) {
      return { mode: 'hero-memory', label: '' }
    }

    const fragmentBtn = target.closest('[data-fragment]')
    if (fragmentBtn) {
      return { mode: 'interactive', label: 'mover' }
    }

    const processCard = target.closest('#oficina .process-slide')
    if (processCard) {
      return { mode: 'interactive', label: 'ler' }
    }

    const canvas3d = target.closest('#instalacao canvas')
    if (canvas3d) {
      return { mode: 'interactive', label: 'explorar' }
    }

    const filmButton = target.closest('#fotofilmes button[aria-label*="fotofilme"]')
    if (filmButton) {
      return { mode: 'interactive', label: filmButton.textContent?.trim() || 'ver' }
    }

    const interactiveLink = target.closest('a, button, [role="button"]')
    if (interactiveLink) {
      return { mode: 'link', label: '' }
    }

    return { mode: 'default', label: '' }
  }

  const onPointerMove = (event) => {
    pointerX = event.clientX
    pointerY = event.clientY

    if (!cursorEl) return

    if (!cursorVisible) {
      smoothX = pointerX
      smoothY = pointerY
      cursorVisible = true
      cursorEl.classList.add('is-visible')
    }

    startCursorTicker()

    const { mode, label } = resolveCursorContext(event.target)
    if (cursorEl.dataset.cursorMode !== mode) {
      cursorEl.dataset.cursorMode = mode
    }
    if (cursorLabel && cursorLabel.textContent !== label) {
      cursorLabel.textContent = label
    }
  }

  const onPointerLeaveWindow = () => {
    if (!cursorEl) return
    cursorVisible = false
    cursorEl.classList.remove('is-visible')
    stopCursorTicker()
  }

  const stopCursorTicker = () => {
    if (!cursorTickerActive) return
    gsap.ticker.remove(tickerRender)
    cursorTickerActive = false
  }

  const startCursorTicker = () => {
    if (cursorTickerActive || !cursorEl || !cursorVisible) return
    cursorTickerActive = true
    gsap.ticker.add(tickerRender)
  }

  const tickerRender = () => {
    if (!cursorEl || !cursorVisible || reducedMotionQuery.matches) {
      stopCursorTicker()
      return
    }
    const ratio = gsap.ticker.deltaRatio(60)
    const ease = 1 - Math.pow(0.8, ratio)
    smoothX += (pointerX - smoothX) * ease
    smoothY += (pointerY - smoothY) * ease
    cursorEl.style.transform = `translate3d(${smoothX.toFixed(2)}px, ${smoothY.toFixed(2)}px, 0)`

    if (Math.abs(pointerX - smoothX) < 0.05 && Math.abs(pointerY - smoothY) < 0.05) {
      smoothX = pointerX
      smoothY = pointerY
      cursorEl.style.transform = `translate3d(${smoothX.toFixed(2)}px, ${smoothY.toFixed(2)}px, 0)`
      stopCursorTicker()
    }
  }

  // 7. Micro-interação magnética suave nos links de navegação e controles editoriais
  if (finePointerQuery.matches && !reducedMotionQuery.matches) {
    const magneticTargets = [
      ...header.querySelectorAll('nav a, :scope > a'),
      ...document.querySelectorAll('#fragmentos button[type="button"], #fotofilmes button[type="button"], footer a'),
    ]

    magneticTargets.forEach((element) => {
      const xTo = gsap.quickTo(element, 'x', { duration: 0.35, ease: 'power3.out' })
      const yTo = gsap.quickTo(element, 'y', { duration: 0.35, ease: 'power3.out' })

      let cachedRect = null
      const onEnter = () => {
        cachedRect = element.getBoundingClientRect()
      }

      const onMove = (e) => {
        if (reducedMotionQuery.matches) return
        if (!cachedRect) cachedRect = element.getBoundingClientRect()
        const relX = e.clientX - (cachedRect.left + cachedRect.width / 2)
        const relY = e.clientY - (cachedRect.top + cachedRect.height / 2)
        xTo(clamp(relX * 0.18, -8, 8))
        yTo(clamp(relY * 0.22, -5, 5))
      }

      const onLeave = () => {
        cachedRect = null
        xTo(0)
        yTo(0)
      }

      element.addEventListener('pointerenter', onEnter)
      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerleave', onLeave)
      magneticCleanups.push(() => {
        element.removeEventListener('pointerenter', onEnter)
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerleave', onLeave)
        gsap.set(element, { clearProps: 'x,y' })
      })
    })
  }

  let scrollSyncFrame = 0
  const requestScrollNavSync = () => {
    if (!scrollSyncFrame) {
      scrollSyncFrame = window.requestAnimationFrame(() => {
        scrollSyncFrame = 0
        updateScrollNavigation()
      })
    }
  }

  const onViewportResize = () => {
    measureSectionRanges()
    requestScrollNavSync()
  }

  const onReducedMotionChange = () => {
    setupScrollAnimations()
    measureSectionRanges()
    updateScrollNavigation()
  }

  measureSectionRanges()
  updateScrollNavigation()
  window.addEventListener('scroll', requestScrollNavSync, { passive: true })
  window.addEventListener('resize', onViewportResize, { passive: true })
  ScrollTrigger.addEventListener('refresh', onViewportResize)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('mouseleave', onPointerLeaveWindow)
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)

  const cleanup = () => {
    window.cancelAnimationFrame(scrollSyncFrame)
    stopCursorTicker()
    instalacaoObserver.disconnect()
    lateLegacyObserver.disconnect()
    window.clearTimeout(lateLegacyTimer)
    gsapCtx?.revert()
    splitRecords.splice(0).forEach((record) => record.revert())
    magneticCleanups.splice(0).forEach((fn) => fn())
    window.removeEventListener('scroll', requestScrollNavSync)
    window.removeEventListener('resize', onViewportResize)
    ScrollTrigger.removeEventListener('refresh', onViewportResize)
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('mouseleave', onPointerLeaveWindow)
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
    progressBar.remove()
    cursorEl?.remove()
    delete header.dataset.navTheme
    header.classList.remove('hipocampo-header-scrolled')
    delete document.documentElement.dataset.editorialMotionReady
    delete window.__hipocampoEditorialCleanup
  }

  window.__hipocampoEditorialCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeEditorialRedesign()) {
  const bootObserver = new MutationObserver(() => {
    if (initializeEditorialRedesign()) {
      bootObserver.disconnect()
    }
  })
  bootObserver.observe(document.documentElement, { childList: true, subtree: true })
}
