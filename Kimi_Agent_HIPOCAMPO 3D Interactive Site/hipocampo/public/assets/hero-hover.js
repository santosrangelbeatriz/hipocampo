const photoSources = [
  '/images/hero/foto-01.webp',
  '/images/hero/foto-02.webp',
  '/images/hero/foto-03.webp',
  '/images/hero/foto-04.webp',
  '/images/hero/foto-05.png',
  '/images/hero/foto-06.webp',
  '/images/hero/foto-07.webp',
  '/images/hero/foto-08.webp',
  '/images/hero/foto-09.webp',
]

const photoGroups = [
  [0, 1, 2, 3, 4],
  [2, 4, 5, 6],
  [5, 7, 8, 0, 2],
  [8, 1, 3, 6],
  [1, 4, 7, 2, 5],
  [3, 6, 0, 8],
  [6, 2, 5, 1, 7],
  [4, 8, 3, 7],
]

const hoverCapability = window.matchMedia('(hover: hover) and (pointer: fine)')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const scrollProgressLimit = 0.05

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
)

function createPhotoStrip(group, lineIndex) {
  const strip = document.createElement('span')
  strip.className = 'hipocampo-hero-photo-strip'
  strip.setAttribute('aria-hidden', 'true')

  group.forEach((photoIndex, groupIndex) => {
    const image = document.createElement('img')
    const rotation = Math.random() * 8 - 4
    const verticalOffset = Math.random() * 0.24 - 0.12

    image.className = 'hipocampo-hero-photo'
    image.src = photoSources[photoIndex]
    image.alt = ''
    image.loading = 'eager'
    image.decoding = 'async'
    image.draggable = false
    image.style.setProperty('--hipocampo-photo-rotation', `${rotation.toFixed(2)}deg`)
    image.style.setProperty('--hipocampo-photo-y', `${verticalOffset.toFixed(3)}em`)
    image.style.setProperty('--hipocampo-photo-delay', `${groupIndex * 40}ms`)
    image.style.zIndex = String(group.length - groupIndex + lineIndex)
    strip.append(image)
  })

  return strip
}

function initializeHeroHover() {
  const scene = document.querySelector('#abertura')
  const field = scene?.querySelector('.hipocampo-memory-field')

  if (!scene || !field || field.dataset.photoHoverInitialized === 'true') {
    return false
  }

  const lines = [...field.querySelectorAll(':scope > span')].slice(0, photoGroups.length)

  if (lines.length !== photoGroups.length) {
    return false
  }

  window.__hipocampoHeroHoverCleanup?.()
  field.dataset.photoHoverInitialized = 'true'

  const strips = lines.map((line, lineIndex) => {
    const strip = createPhotoStrip(photoGroups[lineIndex], lineIndex)
    line.classList.add('hipocampo-memory-line')
    line.append(strip)
    return strip
  })

  let activeLine = null
  let activeStrip = null
  let currentX = 0
  let targetX = 0
  let movementFrame = 0
  let scrollFrame = 0
  let scrollDisabled = false
  const lineListeners = []

  const renderPosition = () => {
    movementFrame = 0

    if (!activeStrip) {
      return
    }

    currentX = reducedMotion.matches
      ? targetX
      : currentX + (targetX - currentX) * 0.18
    activeStrip.style.setProperty('--hipocampo-photo-x', `${currentX.toFixed(2)}px`)

    if (!reducedMotion.matches && Math.abs(targetX - currentX) > 0.1) {
      movementFrame = window.requestAnimationFrame(renderPosition)
    }
  }

  const requestPositionRender = () => {
    if (!movementFrame) {
      movementFrame = window.requestAnimationFrame(renderPosition)
    }
  }

  const updateTarget = (line, strip, clientX, immediate = false) => {
    const lineRect = line.getBoundingClientRect()
    const stripWidth = strip.offsetWidth
    const edgeInset = Math.min(lineRect.width / 2, stripWidth / 2)
    const maximum = Math.max(edgeInset, lineRect.width - edgeInset)

    targetX = clamp(clientX - lineRect.left, edgeInset, maximum)

    if (immediate || reducedMotion.matches) {
      currentX = targetX
      strip.style.setProperty('--hipocampo-photo-x', `${currentX.toFixed(2)}px`)
    } else {
      requestPositionRender()
    }
  }

  const hideActiveStrip = (immediate = false) => {
    if (!activeLine || !activeStrip) {
      return
    }

    const stripToHide = activeStrip
    activeLine.classList.remove('hipocampo-photo-active')
    stripToHide.classList.remove('hipocampo-photo-strip-visible')

    if (immediate) {
      stripToHide.classList.add('hipocampo-photo-strip-immediate')
      window.requestAnimationFrame(() => {
        stripToHide.classList.remove('hipocampo-photo-strip-immediate')
      })
    }

    activeLine = null
    activeStrip = null
    window.cancelAnimationFrame(movementFrame)
    movementFrame = 0
  }

  const canShowPhotos = () => hoverCapability.matches && !scrollDisabled

  lines.forEach((line, lineIndex) => {
    const strip = strips[lineIndex]
    const onPointerEnter = (event) => {
      if (!canShowPhotos()) {
        return
      }

      hideActiveStrip()
      activeLine = line
      activeStrip = strip
      updateTarget(line, strip, event.clientX, true)
      line.classList.add('hipocampo-photo-active')
      window.requestAnimationFrame(() => {
        if (activeStrip === strip && canShowPhotos()) {
          strip.classList.add('hipocampo-photo-strip-visible')
        }
      })
    }
    const onPointerMove = (event) => {
      if (activeStrip === strip && canShowPhotos()) {
        updateTarget(line, strip, event.clientX)
      }
    }
    const onPointerLeave = () => {
      if (activeStrip === strip) {
        hideActiveStrip()
      }
    }

    line.addEventListener('pointerenter', onPointerEnter)
    line.addEventListener('pointermove', onPointerMove)
    line.addEventListener('pointerleave', onPointerLeave)
    lineListeners.push({ line, onPointerEnter, onPointerMove, onPointerLeave })
  })

  const syncScrollState = () => {
    scrollFrame = 0
    const progress = Number.parseFloat(
      window.getComputedStyle(scene).getPropertyValue('--hipocampo-scroll-progress'),
    ) || 0
    const shouldDisable = progress > scrollProgressLimit

    if (shouldDisable === scrollDisabled) {
      return
    }

    scrollDisabled = shouldDisable
    field.classList.toggle('hipocampo-photo-hover-disabled', scrollDisabled)

    if (scrollDisabled) {
      hideActiveStrip(true)
    }
  }

  const requestScrollSync = () => {
    if (!scrollFrame) {
      scrollFrame = window.requestAnimationFrame(syncScrollState)
    }
  }

  const onHoverCapabilityChange = () => {
    if (!hoverCapability.matches) {
      hideActiveStrip(true)
    }
  }

  const cleanup = () => {
    window.cancelAnimationFrame(movementFrame)
    window.cancelAnimationFrame(scrollFrame)
    window.removeEventListener('scroll', requestScrollSync)
    window.removeEventListener('pagehide', cleanup)
    hoverCapability.removeEventListener('change', onHoverCapabilityChange)
    lineListeners.forEach(({ line, onPointerEnter, onPointerMove, onPointerLeave }) => {
      line.removeEventListener('pointerenter', onPointerEnter)
      line.removeEventListener('pointermove', onPointerMove)
      line.removeEventListener('pointerleave', onPointerLeave)
      line.classList.remove('hipocampo-memory-line', 'hipocampo-photo-active')
    })
    strips.forEach((strip) => strip.remove())
    field.classList.remove('hipocampo-photo-hover-disabled')
    delete field.dataset.photoHoverInitialized
    delete window.__hipocampoHeroHoverCleanup
  }

  syncScrollState()
  window.addEventListener('scroll', requestScrollSync, { passive: true })
  hoverCapability.addEventListener('change', onHoverCapabilityChange)
  window.__hipocampoHeroHoverCleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializeHeroHover()) {
  const observer = new MutationObserver(() => {
    if (initializeHeroHover()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
