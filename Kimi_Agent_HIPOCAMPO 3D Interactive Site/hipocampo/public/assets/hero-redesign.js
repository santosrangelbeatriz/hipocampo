const repeatLine = 'uma memória desapareceu uma memória desapareceu'

function createHeroMarkup() {
  const stage = document.createElement('div')
  stage.className = 'hipocampo-hero-stage'

  const lines = Array.from({ length: 8 }, () => (
    `<span class="hipocampo-memory-line" aria-label="${repeatLine}">${repeatLine}</span>`
  )).join('')

  stage.innerHTML = `
    <h1 class="hipocampo-hero-title">Uma memória desapareceu</h1>
    <div class="hipocampo-hero-visuals">
      <div class="hipocampo-hero-texture" aria-hidden="true"></div>
      <div class="hipocampo-transition-circle" aria-hidden="true">
        <span class="hipocampo-transition-circle-fill"></span>
      </div>
      <div class="hipocampo-memory-field">${lines}</div>
    </div>
  `

  return stage
}

function initializeHero() {
  const hero = document.querySelector('#abertura')
  const navigation = document.querySelector('body > #root > header')

  if (!hero || !navigation) {
    return false
  }

  if (hero.dataset.redesigned === 'true') {
    return true
  }

  hero.dataset.redesigned = 'true'
  hero.className = 'hipocampo-hero'
  hero.replaceChildren(createHeroMarkup())

  const logo = navigation.querySelector(':scope > a')
  if (logo) {
    logo.textContent = 'Hipocampo'
  }

  navigation.classList.remove('hipocampo-nav-on-hero')
  navigation.classList.add('hipocampo-global-header')
  navigation.style.mixBlendMode = 'normal'
  return true
}

if (!initializeHero()) {
  window.__hipocampoWhenReady?.(initializeHero)
}
