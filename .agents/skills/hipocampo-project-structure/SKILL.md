---
name: hipocampo-project-structure
description: Diagnostica build e execução do repositório HIPOCAMPO, seus HTMLs, Vite, assets de build e arquivos ausentes; use quando página abre sem CSS/JS ou quando npm falha.
---

# Estrutura e execução do HIPOCAMPO

## Fatos do repositório e evolução local
- Projeto GitHub `santosrangelbeatriz/hipocampo`.
- Diretório da aplicação: `Kimi_Agent_HIPOCAMPO 3D Interactive Site/hipocampo/`.
- Existe também `Kimi_Agent_HIPOCAMPO 3D Interactive Site/hipocampo.html` (HTML independente).
- Versão original do `hipocampo/index.html` referenciava `/src/main.js` ausente da árvore GitHub inicial; Live Server mostra HTML sem estilos quando assets/script ausentes.
- Em capturas posteriores do workspace aparecem `public/assets/index-*.css`, JS da aplicação e JS da instalação 3D, `scripts/`, `server.mjs`, `dist/` e SquidBoy; NÃO presuma que todos estejam commitados no remoto.

## Roteiro de diagnóstico
1. `git status --short`, `git branch --show-current`, `git ls-files` e inspecionar estrutura atual.
2. Abrir `package.json`, `index.html`, `vite.config.ts`, `server.mjs`, `scripts/`, `public/assets`.
3. Escolher uma única entrada oficial, documentar se assets vêm de fonte ou de build recuperado.
4. Checar `href/src`, importações de `src/main.js`, `.figma/make/site.json`, bases `/` e referências ausentes.
5. Instalar dependências de forma compatível com lockfile presente; executar script `dev` ou `build` existente, não inventar comandos.
6. Verificar erros de console/network (404 de CSS/JS, MIME, CORS), além do build.
7. Não considerar `dist/` como código-fonte editável; não depender de arquivos minificados como única fonte sem documentar limitação.

## Segurança
Não subir `.env`, tokens, `node_modules`, `dist` se for apenas produto de build. `public/assets` pode ser essencial nessa versão recuperada: verifique antes de ignorar/excluir.
