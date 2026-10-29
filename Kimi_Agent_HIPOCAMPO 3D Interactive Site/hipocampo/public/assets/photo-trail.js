// Photo trail is scoped to the opening; it does not capture clicks or scrolling.
const photoSources = [
  { src: '/images/trail/photo-1.webp', shape: 'torn' },
  { src: '/images/trail/photo-2.webp', shape: 'oval' },
  { src: '/images/trail/mountains-cutout.webp', shape: 'cutout' },
  { src: '/images/trail/birds-cutout.webp', shape: 'cutout' },
  { src: '/images/trail/photo-5.webp', shape: 'arch' },
  { src: '/images/trail/tv-cutout.webp', shape: 'cutout' },
  { src: '/images/trail/photo-7.webp', shape: 'film' },
  { src: '/images/trail/photo-8.webp', shape: 'torn' },
  { src: '/images/trail/photo-9.webp', shape: 'oval' },
]
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const style = document.createElement('style')
style.textContent = `
.hipocampo-photo-trail { position: absolute; inset: 0; z-index: 3; overflow: hidden; pointer-events: none; contain: strict; }
.hipocampo-trail-photo { position: absolute; width: clamp(88px, 11vw, 150px); height: auto; max-height: 190px; object-fit: contain; pointer-events: none; opacity: 0; transform: translate(-50%, -50%); }
.hipocampo-trail-photo.is-active { will-change: transform, opacity; }
.hipocampo-trail-photo--oval { clip-path: ellipse(49% 49% at 50% 50%); }
.hipocampo-trail-photo--arch { border-radius: 48% 48% 3% 3% / 38% 38% 3% 3%; }
.hipocampo-trail-photo--torn { -webkit-mask: url('/images/trail/torn-mask.png') 50% 50% / 100% 100% no-repeat; mask: url('/images/trail/torn-mask.png') 50% 50% / 100% 100% no-repeat; }
.hipocampo-trail-photo--film { width: clamp(55px, 6vw, 80px); }
@media (prefers-reduced-motion: reduce) { .hipocampo-photo-trail { display: none; } }
`
document.head.append(style)

function initializePhotoTrail() {
  const hero = document.querySelector('#abertura.hipocampo-hero')
  const visuals = hero?.querySelector('.hipocampo-hero-visuals')
  if (!hero || !visuals) return false
  if (visuals.querySelector('.hipocampo-photo-trail')) return true

  const layer = document.createElement('div')
  layer.className = 'hipocampo-photo-trail'
  layer.setAttribute('aria-hidden', 'true')
  visuals.append(layer)
  let previous = null
  let index = 0
  let lastSpawn = 0
  let preloaded = false
  let heroRect = null
  const slots = Array.from({ length: 12 }, () => {
    const image = document.createElement('img')
    image.alt = ''
    image.decoding = 'async'
    image.className = 'hipocampo-trail-photo'
    layer.append(image)
    return { image, animation: null }
  })
  let slotIndex = 0
  const invalidateRect = () => { heroRect = null }

  // Pré-carrega e decodifica as fotos fora do caminho do mouse, para não travar no primeiro hover.
  const preload = () => {
    if (preloaded) return
    preloaded = true
    photoSources.forEach(({ src }) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = src
      image.decode?.().catch(() => {})
    })
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 2500 })
  else window.setTimeout(preload, 1200)

  function clear() {
    previous = null
    slots.forEach((slot) => {
      slot.animation?.cancel()
      slot.animation = null
      slot.image.classList.remove('is-active')
      slot.image.style.opacity = '0'
    })
  }

  function move(event) {
    if (reducedMotion.matches || (event.pointerType === 'touch' && event.buttons === 0)) return
    if (event.target.closest('a, button, input, select, textarea')) return
    if (!heroRect) heroRect = hero.getBoundingClientRect()
    const rect = heroRect
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const now = performance.now()
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
    if (previous && (Math.hypot(x - previous.x, y - previous.y) < 90 || now - lastSpawn < 60)) return
    preload()
    previous = { x, y }
    lastSpawn = now
    const slot = slots[slotIndex % slots.length]
    const image = slot.image
    const photo = photoSources[index % photoSources.length]
    slotIndex += 1
    slot.animation?.cancel()
    image.src = photo.src
    image.className = `hipocampo-trail-photo hipocampo-trail-photo--${photo.shape}`
    image.style.left = `${x}px`
    image.style.top = `${y}px`
    const rotation = `${((Math.random() - .5) * 12).toFixed(2)}deg`
    index += 1
    image.classList.add('is-active')
    const animation = image.animate([
      { opacity: 0, transform: `translate(-50%, -50%) rotate(${rotation}) scale(.6)`, offset: 0 },
      { opacity: 1, transform: `translate(-50%, -50%) rotate(${rotation}) scale(1)`, offset: 0.12 },
      { opacity: 1, offset: 0.7 },
      { opacity: 0, transform: `translate(-50%, -50%) rotate(${rotation}) scale(.85)`, offset: 1 },
    ], {
      duration: 1400,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards',
    })
    slot.animation = animation
    animation.onfinish = () => {
      if (slot.animation !== animation) return
      slot.animation = null
      image.classList.remove('is-active')
    }
  }

  hero.addEventListener('pointermove', move, { passive: true })
  hero.addEventListener('pointerenter', invalidateRect, { passive: true })
  hero.addEventListener('pointerleave', () => { previous = null })
  window.addEventListener('resize', invalidateRect, { passive: true })
  window.addEventListener('scroll', () => {
    invalidateRect()
    if (previous || slots.some((slot) => slot.animation)) clear()
  }, { passive: true })
  reducedMotion.addEventListener('change', clear)
  window.addEventListener('pagehide', clear)
  return true
}

if (!initializePhotoTrail()) {
  window.__hipocampoWhenReady?.(initializePhotoTrail)
}
