---
name: hipocampo-accessibility-qa
description: Executa checklist de QA visual, funcional, responsivo e acessível para o HIPOCAMPO; use antes de declarar uma alteração concluída ou abrir PR.
---

# QA do HIPOCAMPO

## Matriz mínima
1. Hero desktop 1600x900 / 1366x768 e mobile 390x844 / 375x667.
2. Textura discreta, alinhamento, fontes carregadas, único logo, navegação em branco sem barra, círculo abaixo do texto.
3. Sem cortes, overflow horizontal, sobreposição de cabeçalho, 404 CSS/JS/fontes.
4. Se transição ativada: scroll ida/volta, pin, segunda seção amarela e sem salto, navegação por âncoras.
5. Seções subsequentes: oficina, instalação 3D, fragmentos, fotofilmes, informações.
6. Formatos teclado, mouse, touch, zoom, reduced motion.
7. Console sem erros críticos, build rodando, página efetivamente renderizada.

## Relatório de saída
Relate: arquivos modificados, comandos executados, testes que passaram, os que NÃO foram possíveis, diferenças visuais restantes e riscos. Não invente prova de screenshot nem afirme build OK sem executá-lo.
