---
name: hipocampo-3d-installation
description: Mantém e evolui a instalação virtual 3D do HIPOCAMPO; use para interação com ilhas, objetos, WebGL, performance e prevenção de regressões.
---

# Instalação 3D — HIPOCAMPO

## Regras
- Preserve a experiência de quatro ilhas, os objetos manipuláveis, textos de memória, opção de recompor sala e controles por mouse/touch.
- Encontre o script real associado à sala 3D (ex.: arquivo com prefixo `Instalacao3D-` em `public/assets`) antes de alterar markup.
- Evite recriar a sala inteira se só foi solicitado ajuste da hero.
- Separe listeners de arrastar a cena e listeners de arrastar objetos; impedir conflito com scroll vertical e foco.
- Monitore uso de GPU, `devicePixelRatio`, resize, context loss e desligamento de animações fora da tela.
- Forneça fallback acessível: descrição textual dos objetos/memórias, navegação por teclado, controles rotulados.
- Verifique z-index: a nova animação da hero nunca deve interceptar input da sala 3D.

## Critérios de regressão
Ao alterar JS/CSS global, teste drag, seleção de objetos, popup/memória, reset, mobile touch, renderização em navegadores sem aceleração.
