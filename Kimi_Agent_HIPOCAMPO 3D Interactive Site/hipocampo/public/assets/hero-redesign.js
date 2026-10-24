const repeatLine = 'uma memória desapareceu uma memória desapareceu'

function createHeroMarkup() {
  const stage = document.createElement('div')
  stage.className = 'hipocampo-hero-stage'
  stage.innerHTML = `
    <div class="hipocampo-hero-texture" aria-hidden="true"></div>
    <h1 class="hipocampo-hero-title">Uma memória desapareceu</h1>
    <div class="hipocampo-memory-field" aria-hidden="true">
      ${Array.from({ length: 8 }, () => `<span>${repeatLine}</span>`).join('')}
    </div>
    <div class="hipocampo-transition-circle" aria-hidden="true"></div>
  `
  return stage
}

function initializeHero() {
  const hero = document.querySelector('#abertura')
  const navigation = document.querySelector('body > #root > header')

  if (!hero || !navigation || hero.dataset.redesigned === 'true') {
    return false
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
  const observer = new MutationObserver(() => {
    if (initializeHero()) {
      observer.disconnect()
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
