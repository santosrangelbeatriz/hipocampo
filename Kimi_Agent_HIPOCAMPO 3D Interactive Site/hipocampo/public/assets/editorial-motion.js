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

  // 2. Indicador editorial sutil na abertura (se não existir)
  const heroStage = hero.querySelector('.hipocampo-hero-stage')
  let heroScrollCue = heroStage?.querySelector('.hipocampo-hero-scroll-cue')
  if (heroStage && !heroScrollCue) {
    heroScrollCue = document.createElement('div')
    heroScrollCue.className = 'hipocampo-hero-scroll-cue'
    heroScrollCue.setAttribute('aria-hidden', 'true')
    heroScrollCue.textContent = 'descer para tentar lembrar'
    heroStage.append(heroScrollCue)
  }

  // 3. Limpar triggers antigos conflitantes nas seções pós-hero
  const managedSections = [oficina, instalacao, fragmentos, fotofilmes, informacoes].filter(Boolean)
  clearLegacySectionTriggers(managedSections)

  // 4. Construir contexto GSAP reversível (respeitando prefers-reduced-motion)
  let gsapCtx = null

  const setupScrollAnimations = () => {
    gsapCtx?.revert()
    splitRecords.splice(0).forEach((record) => record.revert())

    if (reducedMotionQuery.matches) {
      return
    }

    gsapCtx = gsap.context(() => {
      // Abertura: deriva horizontal editorial sutil alternada nas linhas de memória durante o scroll
      const heroLines = gsap.utils.toArray(
        '#abertura .hipocampo-memory-field > span:not([data-memory-marquee="true"])',
      )
      if (heroLines.length) {
        gsap.fromTo(
          heroLines,
          {
            opacity: 0,
            yPercent: 32,
          },
          {
            opacity: 1,
            yPercent: 0,
            duration: 1.05,
            stagger: 0.055,
            ease: 'power3.out',
            clearProps: 'opacity,transform',
          },
        )

        heroLines.forEach((line, index) => {
          const direction = index % 2 === 0 ? -1 : 1
          const amplitude = 1.6 + (index % 3) * 0.85
          gsap.to(line, {
            xPercent: direction * amplitude,
            ease: 'none',
            scrollTrigger: {
              trigger: hero,
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          })
        })
      }

      // Preparar e animar títulos e cabeçalhos editoriais nas seções
      const narrativeSections = [
        projeto,
        oficina,
        instalacao,
        fragmentos,
        fotofilmes,
        informacoes,
      ].filter(Boolean)

      narrativeSections.forEach((section) => {
        const isStickyProject = section.id === 'projeto'
        const headings = section.querySelectorAll('h2, h3')

        headings.forEach((heading) => {
          // Na seção fotofilmes, h3 do Fotofilme A possui posicionamento absoluto delicado; animamos suas linhas internas
          const record = prepareEditorialHeading(heading)
          if (record) {
            splitRecords.push(record)
            if (!isStickyProject) {
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
          }
        })

        if (isStickyProject) {
          // A seção #projeto já é controlada de forma contínua pelo círculo de transição da abertura.
          // Adicionamos apenas revelação progressiva na fotografia de arquivo ao final da seção.
          const figure = section.querySelector('figure.negative-frame')
          const img = figure?.querySelector('img')
          if (figure && img) {
            gsap.fromTo(
              img,
              { scale: 1.08 },
              {
                scale: 1,
                ease: 'none',
                scrollTrigger: {
                  trigger: figure,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: true,
                },
              },
            )
          }
          return
        }

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

  const updateScrollNavigation = () => {
    const scrollY = window.scrollY
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    const pageProgress = clamp(scrollY / maxScroll, 0, 1)
    document.documentElement.style.setProperty('--hip-page-progress', pageProgress.toFixed(4))

    header.classList.toggle('hipocampo-header-scrolled', scrollY > 72)

    const probeY = window.innerHeight * 0.28
    let activeId = 'abertura'
    let activeTheme = 'dark'
    let activeCursorTheme = 'on-blue'

    const heroProgress = Number.parseFloat(
      window.getComputedStyle(hero).getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0

    for (const item of sectionThemeMap) {
      const el = document.getElementById(item.id)
      if (!el) continue

      if (item.id === 'projeto' && el.classList.contains('hipocampo-transition-project')) {
        if (heroProgress >= 0.48) {
          activeId = 'projeto'
          activeTheme = item.theme
          activeCursorTheme = item.cursorTheme
        }
        continue
      }

      const rect = el.getBoundingClientRect()
      if (rect.top <= probeY && rect.bottom >= probeY) {
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

    header.dataset.navTheme = activeTheme
    currentCursorTheme = activeCursorTheme
    if (cursorEl) {
      cursorEl.dataset.cursorTheme = currentCursorTheme
    }

    navLinks.forEach((link) => {
      const targetId = link.getAttribute('href')?.slice(1)
      link.classList.toggle('is-active-section', targetId === activeId)
    })
  }

  // 6. Cursor contextual com suavização (acoplado ao gsap.ticker para evitar loops rAF duplicados)
  let cursorEl = null
  let cursorLabel = null
  let pointerX = -100
  let pointerY = -100
  let smoothX = -100
  let smoothY = -100
  let cursorVisible = false

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

    if (target.closest('.hipocampo-memory-photo')) {
      return { mode: 'hero-memory-photo', label: '' }
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
  }

  const tickerRender = () => {
    if (!cursorEl || !cursorVisible || reducedMotionQuery.matches) return
    const ratio = gsap.ticker.deltaRatio(60)
    const ease = 1 - Math.pow(0.8, ratio)
    smoothX += (pointerX - smoothX) * ease
    smoothY += (pointerY - smoothY) * ease
    cursorEl.style.transform = `translate3d(${smoothX.toFixed(2)}px, ${smoothY.toFixed(2)}px, 0)`
  }

  gsap.ticker.add(tickerRender)

  // 7. Micro-interação magnética suave nos links de navegação e controles editoriais
  if (finePointerQuery.matches && !reducedMotionQuery.matches) {
    const magneticTargets = [
      ...header.querySelectorAll('nav a, :scope > a'),
      ...document.querySelectorAll('#fragmentos button[type="button"], #fotofilmes button[type="button"], footer a'),
    ]

    magneticTargets.forEach((element) => {
      const xTo = gsap.quickTo(element, 'x', { duration: 0.35, ease: 'power3.out' })
      const yTo = gsap.quickTo(element, 'y', { duration: 0.35, ease: 'power3.out' })

      const onMove = (e) => {
        if (reducedMotionQuery.matches) return
        const rect = element.getBoundingClientRect()
        const relX = e.clientX - (rect.left + rect.width / 2)
        const relY = e.clientY - (rect.top + rect.height / 2)
        xTo(clamp(relX * 0.18, -8, 8))
        yTo(clamp(relY * 0.22, -5, 5))
      }

      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerleave', onLeave)
      magneticCleanups.push(() => {
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

  const onReducedMotionChange = () => {
    setupScrollAnimations()
    updateScrollNavigation()
  }

  updateScrollNavigation()
  window.addEventListener('scroll', requestScrollNavSync, { passive: true })
  window.addEventListener('resize', requestScrollNavSync, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('mouseleave', onPointerLeaveWindow)
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)

  const cleanup = () => {
    window.cancelAnimationFrame(scrollSyncFrame)
    gsap.ticker.remove(tickerRender)
    instalacaoObserver.disconnect()
    gsapCtx?.revert()
    splitRecords.splice(0).forEach((record) => record.revert())
    magneticCleanups.splice(0).forEach((fn) => fn())
    window.removeEventListener('scroll', requestScrollNavSync)
    window.removeEventListener('resize', requestScrollNavSync)
    window.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('mouseleave', onPointerLeaveWindow)
    reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
    progressBar.remove()
    cursorEl?.remove()
    heroScrollCue?.remove()
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
