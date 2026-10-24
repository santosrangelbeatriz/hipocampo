---
name: hipocampo-typography
description: Configura fontes artísticas locais no HIPOCAMPO sem fallback inesperado; use ao tratar logo, SquidBoy, Aquiline, Drowner, Estrella e linhas repetidas.
---

# Tipografia e fontes locais

## Fontes conhecidas
`public/fonts/aquiline-two-regular.ttf`, `drowner-regular.otf`, `estrella-early.otf` e, quando presente no workspace atualizado, `SquidBoy-Thin.otf`.

## Procedimento
1. Valide existência e maiúsculas/minúsculas exatas (deploy Linux é case-sensitive).
2. Registre `@font-face` com caminho compatível com Vite `public/`: `/fonts/SquidBoy-Thin.otf` etc. Caso o site seja servido por caminho não raiz, considere `base` e teste assets no ambiente real.
3. Use família própria para fonte de logo e para texto repetido, não reutilize indiscriminadamente.
4. Aguarde `document.fonts.ready` quando for medir posição/overflow em screenshot.
5. Ajuste line-height, tracking e escala comparando com referência, não apenas por intuição.
6. Não converta o texto em imagem/canvas se prejudicar responsividade e acessibilidade.
7. Verifique glyphs em português e em múltiplos sistemas operacionais.

## Checklist
Nenhum 404 em fontes; logo único; frase amarela correta; linhas sem corte vertical; sem perda em mobile.
