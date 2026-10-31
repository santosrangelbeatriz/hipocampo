// Página 5 — "vestígios": entra logo após a página 4 (#sobre).
function buildSection() {
  const s = document.createElement('section')
  s.id = 'vestigios'
  s.className = 'hipocampo-page5'
  s.setAttribute('aria-label', 'A memória desaparecida')
  s.innerHTML = `
    <div class="page5-left">
      <p class="page5-text">Ao chegar ao Hipocampo, cada participante recebe uma sinopse que apresenta os primeiros vestígios de uma memória desaparecida, marcada por ausências e perguntas sem resposta, nova possibilidade de memória, revelando como atribuímos significado às imagens e aos objetos que sobrevivem ao tempo.</p>
      <img class="page5-camera" src="/images/vestigios/camera-topo.webp" alt="Câmera fotográfica antiga prateada" loading="lazy" />
    </div>
    <div class="page5-right">
      <img class="page5-colagem" src="/images/vestigios/colagem.webp" alt="Colagem de fotografias em preto e branco com recorte laranja" loading="lazy" />
      <img class="page5-filme" src="/images/vestigios/filme.webp" alt="Duas mulheres com rostos cobertos por círculos vermelhos, sob uma tira de filme com carta manuscrita" loading="lazy" />
      <p class="page5-brand" aria-hidden="true">Hipocampo</p>
    </div>`
  return s
}

function init() {
  const sobre = document.querySelector('#sobre')
  if (!sobre) return false
  if (document.querySelector('#vestigios')) return true
  sobre.after(buildSection())
  window.dispatchEvent(new Event('resize'))
  return true
}

if (!init()) {
  const iv = setInterval(() => { if (init()) clearInterval(iv) }, 200)
}
