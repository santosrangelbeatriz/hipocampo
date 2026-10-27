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
.hipocampo-photo-trail { position: absolute; inset: 0; z-index: 3; overflow: hidden; pointer-events: none; }
.hipocampo-trail-photo { position: absolute; width: clamp(88px, 11vw, 150px); height: auto; max-height: 190px; object-fit: contain; pointer-events: none; opacity: 0; transform: translate(-50%, -50%); animation: hipocampo-photo-memory 1.4s cubic-bezier(.2,.8,.2,1) forwards; }
.hipocampo-trail-photo--oval { clip-path: ellipse(49% 49% at 50% 50%); }
.hipocampo-trail-photo--arch { border-radius: 48% 48% 3% 3% / 38% 38% 3% 3%; }
.hipocampo-trail-photo--torn { clip-path: polygon(3% 2%, 19% 0%, 34% 3%, 52% 1%, 70% 3%, 88% 0%, 98% 4%, 96% 22%, 100% 40%, 97% 59%, 99% 78%, 96% 98%, 80% 96%, 62% 100%, 43% 97%, 24% 100%, 2% 97%, 4% 78%, 0% 59%, 3% 39%, 0% 20%); }
.hipocampo-trail-photo--film { width: clamp(55px, 6vw, 80px); }
@keyframes hipocampo-photo-memory {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--photo-rotation)) scale(.6); }
  12% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--photo-rotation)) scale(1); }
  70% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--photo-rotation)) scale(.85); }
}
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
  const timers = new Map()
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
    for (const timer of timers.values()) window.clearTimeout(timer)
    timers.clear()
    if (layer.firstChild) layer.replaceChildren()
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
    const image = document.createElement('img')
    const photo = photoSources[index % photoSources.length]
    image.src = photo.src
    image.alt = ''
    image.decoding = 'async'
    image.className = `hipocampo-trail-photo hipocampo-trail-photo--${photo.shape}`
    image.style.left = `${x}px`
    image.style.top = `${y}px`
    image.style.setProperty('--photo-rotation', `${(Math.random() - .5) * 12}deg`)
    index += 1
    while (layer.children.length >= 12) {
      const oldest = layer.firstElementChild
      if (!oldest) break
      window.clearTimeout(timers.get(oldest))
      timers.delete(oldest)
      oldest.remove()
    }
    layer.append(image)
    timers.set(image, window.setTimeout(() => { image.remove(); timers.delete(image) }, 1400))
  }

  hero.addEventListener('pointermove', move, { passive: true })
  hero.addEventListener('pointerenter', invalidateRect, { passive: true })
  hero.addEventListener('pointerleave', () => { previous = null })
  window.addEventListener('resize', invalidateRect, { passive: true })
  window.addEventListener('scroll', () => {
    invalidateRect()
    if (layer.firstChild || previous) clear()
  }, { passive: true })
  reducedMotion.addEventListener('change', clear)
  window.addEventListener('pagehide', clear)
  return true
}

if (!initializePhotoTrail()) {
  const observer = new MutationObserver(() => {
    if (initializePhotoTrail()) observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
