import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js'

gsap.registerPlugin(ScrollTrigger)

const titleText = 'como uma memória é construída?'
const copyLines = [
  'Uma memória não existe como um registro completo.',
  'Ela se forma a partir de fragmentos: imagens, objetos, sons,',
  'lugares, sensações e histórias que continuam sendo reorganizadas ao longo do tempo.',
  'No Hipocampo, partimos da ausência de uma memória desaparecida.',
  'O que resta são vestígios. Fotografias sem contexto, objetos guardados por anos, anotações, negativos,',
  'relatos incompletos e pequenos artefatos de uma vida que já não pode ser acessada diretamente.',
  'Ao aproximar esses elementos, novas relações surgem.',
  'Uma fotografia pode despertar uma lembrança.',
  'Um objeto pode alterar completamente a interpretação de uma imagem.',
  'Uma história pode preencher uma lacuna ou',
  'criar outra.As conexões construídas entre esses fragmentos revelam',
  'menos uma verdade definitiva e mais as maneiras pelas',
  'quais atribuímos significado às nossas próprias experiências.',
  'Cada participante encontra uma narrativa diferente.',
  'Cada combinação gera uma memória possível.',
]

const photos = [
  { src: '/images/hero/foto-03.webp', alt: 'Pássaros em uma paisagem de cianotipia' },
  { src: '/images/hero/foto-04.webp', alt: 'Cartão-postal de uma montanha' },
  { src: '/images/hero/foto-02.webp', alt: 'Árvore solitária em uma fotografia instantânea' },
  { src: '/images/hero/foto-01.webp', alt: 'Retrato de família parcialmente apagado' },
  { src: '/images/hero/foto-07.webp', alt: 'Negativo fotográfico com flores' },
  { src: '/images/hero/foto-05.webp', alt: 'Rochedos junto ao mar' },
  { src: '/images/hero/foto-06.webp', alt: 'Fotografia antiga de uma criança' },
  { src: '/images/hero/foto-08.webp', alt: 'Televisor antigo refletindo uma figura' },
]

function characterMarkup(text, className) {
  return Array.from(text).map((character) => {
    const value = character === ' ' ? '&nbsp;' : character
    return `<span class="${className}" aria-hidden="true">${value}</span>`
  }).join('')
}

function titleMarkup(text) {
  return text.split(' ').map((word) => (
    `<span class="page2-title-word">${characterMarkup(word, 'page2-title-char')}</span>`
  )).join(' ')
}

function createPage2Markup() {
  const inner = document.createElement('div')
  inner.className = 'hipocampo-page2-inner'

  const accessibleCopy = copyLines.join(' ')
  const photoMarkup = photos.map(({ src, alt }, index) => `
    <figure class="page2-photo page2-photo--${index + 1}">
      <img src="${src}" alt="${alt}" decoding="async" />
    </figure>
  `).join('')

  inner.innerHTML = `
    <h2 id="hipocampo-page2-title" class="hipocampo-page2-title" aria-label="${titleText}">
      ${titleMarkup(titleText)}
    </h2>
    <p class="hipocampo-page2-copy" aria-label="${accessibleCopy}">
      ${copyLines.map((line) => `<span class="page2-copy-line" aria-hidden="true">${line}</span>`).join('')}
    </p>
    <div class="hipocampo-page2-collage" aria-label="Colagem de fotografias e fragmentos de memória">
      ${photoMarkup}
    </div>
  `

  return inner
}

function clearLegacyProjectAnimation(project) {
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.trigger === project) {
      trigger.animation?.kill()
      trigger.kill(true)
    }
  })
  gsap.set(project, { clearProps: 'opacity,transform,translate,rotate,scale' })
}

function initializePage2Motion() {
  const project = document.querySelector('#projeto')
  const header = document.querySelector('body > #root > header')

  if (!project || !header) {
    return false
  }

  if (project.dataset.page2MotionReady === 'true') {
    return true
  }

  window.__hipocampoPage2Cleanup?.()
  clearLegacyProjectAnimation(project)

  const original = {
    className: project.className,
    style: project.getAttribute('style'),
    ariaLabelledby: project.getAttribute('aria-labelledby'),
    nodes: [...project.childNodes].map((node) => node.cloneNode(true)),
  }

  project.className = 'hipocampo-page2'
  project.removeAttribute('style')
  project.setAttribute('aria-labelledby', 'hipocampo-page2-title')
  project.dataset.page2MotionReady = 'true'
  project.replaceChildren(createPage2Markup())

  const titleChars = [...project.querySelectorAll('.page2-title-char')]
  const copyLineElements = [...project.querySelectorAll('.page2-copy-line')]
  const photoElements = [...project.querySelectorAll('.page2-photo')]
  const headerItems = [...header.children]
  const photoCleanups = []
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')

  const ctx = gsap.context(() => {
    gsap.from(titleChars, {
      yPercent: 120,
      rotation: 8,
      opacity: 0,
      stagger: 0.025,
      duration: 1.05,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
      },
    })

    gsap.from(copyLineElements, {
      opacity: 0,
      y: 20,
      filter: 'blur(6px)',
      stagger: 0.06,
      duration: 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 72%',
        toggleActions: 'play none none reverse',
      },
    })

    gsap.from(photoElements, {
      opacity: 0,
      scale: 0.6,
      rotation: (index) => (index % 2 === 0 ? -12 : 12),
      stagger: 0.15,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 76%',
        toggleActions: 'play none none reverse',
      },
    })

    const parallaxValues = [-20, 30, -10]
    photoElements.forEach((photo, index) => {
      gsap.to(photo, {
        yPercent: parallaxValues[index % parallaxValues.length],
        ease: 'none',
        scrollTrigger: {
          trigger: project,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      })
    })

    ScrollTrigger.create({
      trigger: project,
      start: 'top top',
      end: 'bottom top',
      onEnter: () => document.documentElement.classList.add('hipocampo-on-page2'),
      onEnterBack: () => {
        document.documentElement.classList.add('hipocampo-on-page2')
        gsap.set(headerItems, { opacity: 0, y: -80 })
      },
      onLeave: () => {
        document.documentElement.classList.remove('hipocampo-on-page2')
        document.documentElement.classList.remove('hipocampo-transition-white')
        gsap.to(headerItems, {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: 'power2.out',
          overwrite: false,
        })
      },
      onLeaveBack: () => document.documentElement.classList.remove('hipocampo-on-page2'),
    })
  }, project)

  if (finePointer.matches) {
    photoElements.forEach((photo) => {
      const image = photo.querySelector('img')
      let frame = 0
      let pointerX = 0
      let pointerY = 0

      const renderTilt = () => {
        frame = 0
        const rect = photo.getBoundingClientRect()
        const normalizedX = (pointerX - rect.left) / rect.width * 2 - 1
        const normalizedY = (pointerY - rect.top) / rect.height * 2 - 1

        photo.style.zIndex = '30'
        gsap.to(photo, {
          rotateX: clamp(-normalizedY * 10, -10, 10),
          rotateY: clamp(normalizedX * 10, -10, 10),
          scale: 1.08,
          z: 55,
          duration: 0.55,
          ease: 'power3.out',
          overwrite: 'auto',
        })
        gsap.to(image, {
          x: -normalizedX * 8,
          y: -normalizedY * 8,
          scale: 1.12,
          filter: 'grayscale(1) sepia(0.18) saturate(1.6) contrast(1.1)',
          duration: 0.55,
          ease: 'power3.out',
          overwrite: 'auto',
        })
      }

      const onPointerMove = (event) => {
        pointerX = event.clientX
        pointerY = event.clientY
        if (!frame) {
          frame = window.requestAnimationFrame(renderTilt)
        }
      }

      const onPointerLeave = () => {
        window.cancelAnimationFrame(frame)
        frame = 0
        photo.style.zIndex = ''
        gsap.to(photo, {
          rotateX: 0,
          rotateY: 0,
          scale: 1,
          z: 0,
          duration: 1.2,
          ease: 'elastic.out(1,0.6)',
          overwrite: 'auto',
        })
        gsap.to(image, {
          x: 0,
          y: 0,
          scale: 1,
          filter: 'grayscale(1) contrast(1.2) sepia(0.18)',
          duration: 1.2,
          ease: 'elastic.out(1,0.6)',
          overwrite: 'auto',
        })
      }

      photo.addEventListener('pointermove', onPointerMove, { passive: true })
      photo.addEventListener('pointerleave', onPointerLeave)
      photoCleanups.push(() => {
        window.cancelAnimationFrame(frame)
        photo.removeEventListener('pointermove', onPointerMove)
        photo.removeEventListener('pointerleave', onPointerLeave)
      })
    })
  }

  const refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh())

  const cleanup = () => {
    window.cancelAnimationFrame(refreshFrame)
    window.removeEventListener('pagehide', cleanup)
    photoCleanups.splice(0).forEach((fn) => fn())
    ctx.revert()
    document.documentElement.classList.remove('hipocampo-on-page2')
    project.className = original.className
    if (original.style === null) project.removeAttribute('style')
    else project.setAttribute('style', original.style)
    if (original.ariaLabelledby === null) project.removeAttribute('aria-labelledby')
    else project.setAttribute('aria-labelledby', original.ariaLabelledby)
    project.replaceChildren(...original.nodes.map((node) => node.cloneNode(true)))
    delete project.dataset.page2MotionReady
    delete window.__hipocampoPage2Cleanup
  }

  window.__hipocampoPage2Cleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
)

if (!initializePage2Motion()) {
  const observer = new MutationObserver(() => {
    if (initializePage2Motion()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
