// Photo trail is scoped to the opening; it does not capture clicks or scrolling.
const photoSources = Array.from({ length: 9 }, (_, index) => `/images/trail/photo-${index + 1}.png`)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const style = document.createElement('style')
style.textContent = `
.hipocampo-photo-trail { position: absolute; inset: 0; z-index: 3; overflow: hidden; pointer-events: none; }
.hipocampo-trail-photo { position: absolute; width: clamp(140px, 18vw, 260px); max-height: 340px; object-fit: contain; pointer-events: none; opacity: 0; transform: translate(-50%, -50%); animation: hipocampo-photo-memory 1.4s cubic-bezier(.2,.8,.2,1) forwards; }
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
  const timers = new Map()

  function clear() {
    previous = null
    for (const timer of timers.values()) window.clearTimeout(timer)
    timers.clear()
    layer.replaceChildren()
  }

  function move(event) {
    if (reducedMotion.matches || (event.pointerType === 'touch' && event.buttons === 0)) return
    if (event.target.closest('a, button, input, select, textarea')) return
    const rect = hero.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const now = performance.now()
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return
    if (previous && (Math.hypot(x - previous.x, y - previous.y) < 90 || now - lastSpawn < 60)) return
    if (!preloaded) {
      photoSources.forEach((src) => { const image = new Image(); image.src = src })
      preloaded = true
    }
    previous = { x, y }
    lastSpawn = now
    const image = document.createElement('img')
    image.src = photoSources[index % photoSources.length]
    image.alt = ''
    image.className = 'hipocampo-trail-photo'
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
  hero.addEventListener('pointerleave', () => { previous = null })
  window.addEventListener('scroll', clear, { passive: true })
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
