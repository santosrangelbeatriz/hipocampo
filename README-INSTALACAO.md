# Skills HIPOCAMPO — Codex e Antigravity

## Instalação

Copie a pasta oculta `.agents` **e** o arquivo `AGENTS.md` deste pacote para a raiz do repositório local `hipocampo-1` (a pasta em que `git status` funciona), não para `public` nem `dist`. Se já existir `AGENTS.md`, mescle o conteúdo em vez de sobrescrever.

Estrutura:

```text
hipocampo-1/
├── AGENTS.md
├── .agents/
│   └── skills/
│       ├── hipocampo-visual-fidelity/SKILL.md
│       ├── hipocampo-scroll-transition/SKILL.md
│       ├── hipocampo-typography/SKILL.md
│       ├── hipocampo-project-structure/SKILL.md
│       ├── hipocampo-3d-installation/SKILL.md
│       ├── hipocampo-accessibility-qa/SKILL.md
│       └── hipocampo-git-delivery/SKILL.md
└── Kimi_Agent_HIPOCAMPO 3D Interactive Site/
```

Codex e Antigravity reconhecem skills nesse diretório do repositório. Reinicie/recarregue a interface do agente se necessário. No Codex, experimente `$hipocampo-visual-fidelity` em uma solicitação para ativar a skill explicitamente.

## Exemplo de pedido

`Use $hipocampo-visual-fidelity e $hipocampo-typography para comparar a hero atual com a imagem azul anexada. Corrija apenas o layout estático, sem tocar na animação.`

## Antes de publicar

Rode `git status` e inspecione os arquivos criados. Este pacote não altera o repositório GitHub por conta própria.
