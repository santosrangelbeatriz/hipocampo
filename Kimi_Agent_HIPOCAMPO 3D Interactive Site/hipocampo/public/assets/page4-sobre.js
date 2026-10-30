// Página 4 — "o Hipocampo": texto de apresentação + fotos que, ao passar o mouse,
// alternam entre quadros como um gif.
const FRAMES = [1, 2, 3, 4].map((i) => `/images/sobre/gif-${i}.webp`)
const PHOTOS = [
  ['retrato', 'Retrato antigo de uma mulher em moldura oval'],
  ['envelope', 'Envelope antigo com fotografias'],
  ['montanha', 'Fotografia antiga de montanhas'],
]

function buildSection() {
  const s = document.createElement('section')
  s.id = 'sobre'
  s.className = 'hipocampo-page4'
  s.setAttribute('aria-label', 'Sobre o Hipocampo')
  s.innerHTML = `
    <h2 class="page4-title"><small>o</small>Hipocampo</h2>
    <div class="page4-text">
      <p>Hipocampo é uma instalação e oficina experimental que investiga as relações entre memória, imagem e narrativa.</p>
      <p>A partir de fotografias, objetos, negativos e outros vestígios de uma história desconhecida, os participantes exploram a instalação e constroem suas próprias interpretações.</p>
      <p>Sem respostas definitivas, cada narrativa criada revela uma nova forma de compreender o passado, transformando a memória em uma experiência coletiva de imaginação e descoberta.</p>
    </div>
    <div class="page4-photos">
      ${PHOTOS.map(([n, alt]) => `
        <figure class="page4-photo page4-photo--${n}">
          <img src="/images/sobre/${n}.webp" alt="${alt}" loading="lazy" />
          <img class="page4-frame" src="${FRAMES[0]}" alt="" aria-hidden="true" />
        </figure>`).join('')}
    </div>`
  FRAMES.forEach((f) => { const i = new Image(); i.src = f })
  s.querySelectorAll('.page4-photo').forEach((fig) => {
    // o efeito de gif com o mouse fica apenas na carta (envelope)
    if (!fig.classList.contains('page4-photo--envelope')) return
    const frame = fig.querySelector('.page4-frame')
    let t = 0, i = 0
    const start = () => {
      fig.classList.add('is-playing')
      frame.src = FRAMES[i % FRAMES.length]
      t = setInterval(() => { i++; frame.src = FRAMES[i % FRAMES.length] }, 220)
    }
    const stop = () => { clearInterval(t); fig.classList.remove('is-playing') }
    fig.addEventListener('pointerenter', start)
    fig.addEventListener('pointerleave', stop)
  })
  return s
}

function init() {
  const casa = document.querySelector('#casa')
  if (!casa) return false
  if (document.querySelector('#sobre')) return true
  casa.after(buildSection())
  window.dispatchEvent(new Event('resize'))
  return true
}

if (!init()) {
  const iv = setInterval(() => { if (init()) clearInterval(iv) }, 200)
}
