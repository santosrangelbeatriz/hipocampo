---
name: hipocampo-visual-fidelity
description: Replica e revisa a identidade visual do HIPOCAMPO a partir de screenshots; use para corrigir hero, alinhamento, cores, textura, menu e diferenças visuais.
---

# Fidelidade visual — HIPOCAMPO

## Objetivo
A hero deve corresponder à referência azul enviada pelo usuário; não invente nova direção de arte.

## Contexto visual aprovado
- Fundo azul elétrico e textura de pontos minúsculos, regulares e de baixo contraste; não criar bolinhas grandes.
- Frase **“uma memória desapareceu”** em amarelo, em bloco repetitivo horizontal, com composição visual centralizada em desktop.
- Fonte do texto repetido: `public/fonts/SquidBoy-Thin.otf` quando presente; conferir nome real e `@font-face` no CSS. Usar fallback apenas se fonte ausente.
- Logotipo manuscrito **Hipocampo** apenas UMA vez, no canto superior esquerdo, branco e nas proporções da referência.
- Navegação discreta em texto branco sobre o azul, sem faixa branca, sem duplicação de logo.
- Sem contorno branco ou moldura em volta das frases.
- Círculo amarelo centralizado horizontalmente, emergindo da borda inferior.

## Fluxo obrigatório
1. Identifique o HTML/CSS que realmente é usado no servidor atual. Não assuma que `hipocampo.html` e `hipocampo/index.html` sejam equivalentes.
2. Faça screenshot em viewport desktop (~1600x900) e mobile (390x844) antes de editar.
3. Compare, na ordem: geometria do cabeçalho, identidade/tamanho do logo, posição do bloco, número de linhas, fonte, tamanho, espaçamento, cor, pontos e círculo.
4. Corrija só os seletores necessários; preserve seções `#projeto`, `#oficina`, `#instalacao`, `#fragmentos`, `#fotofilmes` e `#informacoes`.
5. Confira contraste, legibilidade e overflow horizontal.
6. Tire screenshot pós-alteração e faça uma comparação lado a lado. Não declare ‘idêntico’ sem comparar.

## Restrições
- Não adicione segunda wordmark. Antes de inserir logo na hero, veja se já existe `.site-header .wordmark`.
- Não adicione borda apenas para depuração no resultado final.
- Não mexa na animação scroll durante a etapa de layout estático, salvo correção indispensável.
