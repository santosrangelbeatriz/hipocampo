# Limpeza do repositório

## Evidência de não uso

Antes das remoções, foi feita uma busca por nome de arquivo e por URL em
`index.html`, `package.json`, `server.mjs`, manifests e todos os arquivos
`*.js`, `*.css` e `*.mjs`, incluindo os bundles minificados. Fora dos próprios
candidatos, não havia referência aos módulos `hero-hover`, `hero-stripes` e
`hero-photo-text`, ao conversor antigo nem a `public/images/hero/`.

`public/images/map/recomposicao.png` era apenas uma imagem de conferência
produzida pelo fatiador. O fatiador continua versionado, mas agora grava essa
conferência em `artifacts/memory-map/recomposicao.png`, fora de `public/` e
ignorada pelo Git.

## Removido do índice do Git, preservado no disco

- `artifacts/` na raiz e no projeto: 108 resultados históricos de testes.
- `node_modules/`: 20 arquivos da dependência `ws`; a instalação local foi
  preservada e pode ser reconstruída com `npm ci`.

Após a limpeza, `git ls-files` não retorna nenhum caminho dentro de
`artifacts/` ou `node_modules/`.

## Código e assets removidos

- `public/assets/hero-hover.js` e `hero-hover.css`: interação substituída pela
  implementação atual da hero e não carregada pelo HTML.
- `public/assets/hero-stripes.js` e `hero-stripes.css`: experimento antigo não
  carregado pelo HTML.
- `public/assets/hero-photo-text.js` e `hero-photo-text.css`: versão antiga da
  hero fotográfica não carregada pelo HTML.
- `public/images/hero/`: dez imagens usadas somente por `hero-photo-text.js`.
- `scripts/convert-hero-photos.mjs`: conversor exclusivo das imagens acima.
- `public/images/map/recomposicao.png`: conferência do fatiamento, sem uso em
  runtime.

## Arquivos reorganizados

- `scripts/motion-qa.py` → `tools/motion-qa.py`.
- `scripts/performance-qa.mjs` → `tools/performance-qa.mjs`.
- `scripts/qa-verify.mjs` → `tools/qa-verify.mjs`.

`scripts/slice-memory-map.py`, as fontes, as 32 peças e o manifest do mapa,
`vendor/lenis.mjs`, os bundles `index-*`/`Instalacao3D-*` e as pastas originais
`fotosparatextoda1imagem/` e `pagina2/` foram preservados.
