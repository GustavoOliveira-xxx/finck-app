# FINCK — Controle Financeiro Inteligente

App de controle financeiro pessoal 100% client-side, sem backend, sem banco de dados — tudo salvo no `localStorage` do navegador.

## Como usar no GitHub Pages

1. Faça upload de todos os arquivos deste repositório na raiz (`/`)
2. Vá em **Settings → Pages → Branch: main → / (root)** e salve
3. Acesse o link gerado (ex: `https://seu-usuario.github.io/finck-app/`)

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Login / Cadastro** | Autenticação local com captcha deslizante |
| **Lançamentos** | Cadastro de entradas e saídas com confirmação |
| **Análises** | Gráficos de comparação e distribuição de gastos |
| **Metas** | Metas financeiras com suporte a CDB/rendimento |
| **Relatórios** | Tabela detalhada + gráficos + exportação CSV |
| **Gamificação** | Sistema de XP, 20 níveis e 8 conquistas |
| **Perfil** | Dados pessoais, backup JSON e reset de dados |

## Tecnologias

- HTML5 + CSS3 + JavaScript (ES6+) puro
- Chart.js (CDN) para gráficos
- `localStorage` para persistência de dados
- Sem dependências de servidor ou PHP

## Estrutura de arquivos

```
finck-app/
├── index.html               Tela de login
├── cadastro.html            Tela de cadastro
├── index-principal.html     Dashboard principal
├── analises.html            Análises e gráficos
├── metas.html               Metas financeiras
├── relatorios.html          Relatórios detalhados
├── gamificacao.html         XP, níveis e conquistas
├── perfil.html              Perfil e configurações
├── auth.js                  Lógica de autenticação
├── script-principal.js      Lógica de lançamentos
├── analises.js              Lógica de análises
├── metas.js                 Lógica de metas
├── relatorios.js            Lógica de relatórios
├── gamificacao.js           Sistema de gamificação
├── perfil.js                Lógica do perfil
├── style-auth.css           Estilos das telas de auth
├── style-principal.css      Design system principal
└── Logo CK - Oficial.png    Logo do app
```
