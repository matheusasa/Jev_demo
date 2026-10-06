# JEV Decision Demos — Next.js

Demonstrações interativas do modelo [JEV da TypeSafe](https://typesafe.ai) usando a API real (`api.typesafe.ai/v1/systemone`).

## Demos incluídas

- **Snake Game** (`/snake`) — Jogo da cobrinha onde cada movimento é decidido pelo JEV via primitivo `Choice`. Visualize probabilidades calibradas e latência em tempo real.
- **Identity Matcher** (`/identity`) — Classificação de identidade única entre sistemas usando `Choice` + múltiplos `Noul` em paralelo. Problema real de matching com decisão tipada.

## Como rodar

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor de desenvolvimento
npm run dev

# 3. Abra no navegador
# http://localhost:3000
```

## API Key

Ambas as demos possuem um campo de input para você colar sua TypeSafe API key diretamente na interface. A chave é enviada apenas para o proxy local (`/api/jev`) e nunca armazenada.

Gere sua chave em: https://typesafe.ai

## Arquitetura

```
src/app/
├── api/jev/route.ts    ← Proxy server-side para api.typesafe.ai (evita CORS)
├── snake/page.tsx      ← Jogo da cobrinha com JEV
├── identity/page.tsx   ← Identity matcher com JEV
├── page.tsx            ← Página inicial com links
├── layout.tsx          ← Layout global com fontes
└── globals.css         ← Estilos base + Tailwind v4
```

O proxy em `/api/jev` recebe as requisições do frontend e as encaminha para `https://api.typesafe.ai/v1/systemone`, resolvendo o problema de CORS sem expor a API key no client-side bundle.

## Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- TypeScript
- Paleta: `#0A0E17` base, `#00D4AA` accent, `#FF6B35` alert, Space Grotesk + Inter + JetBrains Mono