# Cotaria E2E Test Stack

Suite de testes end-to-end (Playwright) para validar o fluxo crítico do painel administrativo operacional.

## 📋 Pré-requisitos

- Node.js >= 18
- Navegadores instalados pelo Playwright (`npx playwright install`)
- Backend e Frontend admin-operacional rodando (padrão: API em `http://localhost:3000` e front em `http://localhost:5173`)

## 🚀 Instalação

```bash
npm install
npx playwright install
```

## 🔧 Configuração

1. Copie `.env.example` para `.env`
2. Ajuste as variáveis conforme o ambiente:
   - `E2E_URL_ADMIN_OPERACIONAL` – URL do administrador operacional
   - `E2E_URL_ADMIN_TECNICO` – URL do administrador técnico
   - `E2E_URL_COTISTA` – URL do front do cotista
   - `E2E_API_URL` – URL da API principal
   - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` – credenciais válidas para login

## ▶️ Execução

- Testes em modo headless:

  ```bash
  npm test
  ```

- Modo interativo/headed:

  ```bash
  npm run test:headed
  ```

- UI do Playwright Test Runner:

  ```bash
  npm run test:ui
  ```

- Regenerar dados com codegen (útil para gravar novos passos):

  ```bash
  npm run codegen -- https://sua-url
  ```

- Abrir relatórios gerados:

  ```bash
  npm run show-report
  ```

## 🧪 Estrutura de testes

```
tests/
  admin-operacional/
    smoke-fluxo-basico.spec.ts
  admin-tecnico/
    .gitkeep
  cotista/
    .gitkeep
```

- `admin-operacional/smoke-fluxo-basico.spec.ts`: fluxo completo (login → criar participante → criar grupo → ativar grupo → criar cota), usando dados randômicos e garantindo independência entre execuções.
- `admin-tecnico/` e `cotista/`: diretórios preparados para os cenários específicos de cada front (adicione novos specs conforme construir a cobertura).

## 💡 Dicas

- Deixe o backend e o front ligados antes de rodar os testes.
- Se o schema Prisma do backend mudar, basta regenerar o client no backend (não é necessário fazer nada aqui).
- Ajuste `playwright.config.ts` caso precise rodar em paralelo, adicionar outros browsers ou integrar com CI/CD.


