---
name: hipocampo-git-delivery
description: Prepara commits e pull requests seguros no repositório HIPOCAMPO; use para revisar diff, separar arquivos gerados, atualizar GitHub ou publicar alterações.
---

# Entrega Git — HIPOCAMPO

## Fluxo
1. Verifique `git status -sb`, `git remote -v`, branch atual e `git diff --stat`.
2. Inspecione `.gitignore` e arquivos não rastreados antes de adicionar; proteja `.env`, credenciais e `node_modules`.
3. Não exclua `public/assets` automaticamente: esta cópia do site pode depender dos assets recuperados.
4. Prefira branch de trabalho `feat/...` ou `fix/...`; nunca force push em `main`.
5. Faça commit apenas de arquivos relacionados à tarefa; não execute `git add .` cegamente.
6. Rode build/checks apropriados e faça diff review antes do commit.
7. Só envie push/abra PR quando o usuário solicitar; confirme destino e diferenças.
8. Não declare deploy automático a partir do push: `kimi.page` pode ser publicação independente.

## Convenção sugerida
`feat(hero): alinhar layout azul à referência`, `fix(build): recuperar recursos CSS e JS`, `feat(scroll): expandir círculo amarelo`.
