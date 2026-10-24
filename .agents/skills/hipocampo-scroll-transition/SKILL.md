---
name: hipocampo-scroll-transition
description: Implementa e depura transição scroll do círculo amarelo do HIPOCAMPO; use após aprovação do layout estático, ao ajustar pin, scrub, reversão e passagem para seção projeto.
---

# Scroll cinematográfico — círculo amarelo

## Objetivo
Na hero azul, círculo amarelo nasce na parte inferior; no scroll ele expande até preencher a área de conteúdo e fundir com a segunda seção `#projeto`, cuja área de fundo é amarela. Ao rolar de volta, efeito reversível.

## Pré-condição
Peça/valide que layout estático tenha sido aprovado; se não, não altere identidade da hero para consertar a transição.

## Implementação
1. Inspecione scripts existentes em `public/assets` e `scripts`, e os handlers de scroll em funcionamento. Evite duplicar listeners/timelines.
2. Use GSAP ScrollTrigger *apenas se já instalado ou se a inclusão for justificada*; caso contrário, use `position: sticky`, progresso normalizado e `requestAnimationFrame` com passividade.
3. Círculo deve ser camada atrás do conteúdo e abaixo da navegação, não cobrir botões nem provocar horizontal overflow.
4. Escala/raio final deve cobrir cantos da viewport: calcule distância máxima do centro do círculo aos quatro cantos; evite números fixos frágeis.
5. Animação deve ser atrelada à posição do scroll, com pin/sticky e scrub; sem `setTimeout` simulando scroll.
6. Evite faixa azul restante ou intervalo vazio entre a hero e o amarelo da seção Projeto.
7. Preserve a barra/nav sem fundo sólido conforme identidade aprovada, mas confira contraste em ambos estados.
8. Respeite `prefers-reduced-motion` com transição imediata e leitura sem bloqueio.

## Testes
- scroll 0%, 25%, 50%, 75%, 100%; retorno 100% a 0%.
- desktop 1600x900; laptop 1366x768; mobile 390x844.
- zoom 125%, resize, navegação por âncoras, scroll via teclado/touchpad/touch.
- Teste `#projeto` e links de menu sem seção oculta pela área sticky.
