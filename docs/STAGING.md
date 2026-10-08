# Staging no Railway

Ambiente separado de homologação, com banco próprio, para validar antes do deploy em produção.

## 1. Criar o ambiente

1. Railway Dashboard → projeto do MenuFácil → **New Environment** → `staging`
2. Dentro do ambiente `staging`: **New** → **PostgreSQL** (banco dedicado, nunca apontar para o banco de produção)
3. **New** → **Service** → conectar ao repositório `menufacil`, branch `staging`

## 2. Variáveis do serviço de staging

```
NODE_ENV=production
PORT=8080
APP_URL=https://staging.up.railway.app   # URL real do serviço de staging
VITE_API_URL=/api
JWT_SECRET=<segredo diferente do de produção>
DATABASE_URL=<interna do Postgres do staging>
MP_LOCAL_MODE=true                        # ou credenciais de teste do MP
MP_ACCESS_TOKEN=TEST-xxx
MP_WEBHOOK_SECRET=
MP_WEBHOOK_URL=https://staging.up.railway.app/api/mp/webhook
ADMIN_EMAIL=<email admin staging>
ADMIN_INITIAL_PASSWORD=<senha admin staging>
ADDITIONAL_CORS_ORIGINS=                  # domínios extras, se houver
```

## 3. Deploy

- **Automático**: push na branch `staging` dispara `.github/workflows/deploy-staging.yml`
  - Secrets: `RAILWAY_STAGING_TOKEN` (Project Token do Railway, escopo do ambiente staging)
  - Vars: `RAILWAY_STAGING_SERVICE` (nome do serviço), `STAGING_URL` (URL pública)
- **Manual**: `railway up --service <serviço> --environment staging`

O workflow valida `/health` ao final do deploy (o `railway.toml` também configura healthcheck com timeout de 300s).

## 4. Banco de dados

- Migrations rodam no start: `prisma migrate deploy` (via `railway.toml`)
- Primeiro deploy em banco existente criado com `db push`: rodar `npm run db:baseline` uma vez
- Seed de homologação (opcional): `npx tsx scripts/seed-test.ts`

## 5. Smoke test pós-deploy

```bash
curl -fsS https://staging.up.railway.app/health
npm run test:e2e   # com E2E_BASE_URL apontando para o staging, se desejado
```

Checklist: login admin, cadastro de tenant, cardápio público, pedido + PIX (modo local), tracking, webhook simulado.

## 6. Diferenças para produção

| Item | Staging | Produção |
|---|---|---|
| Banco | Postgres dedicado | Postgres de produção |
| Mercado Pago | `MP_LOCAL_MODE=true` ou TEST token | Token de produção |
| JWT_SECRET | próprio | próprio |
| UptimeRobot | monitor opcional | monitor `/health` |
| Backup (GitHub Actions) | opcional | diário 05:00 UTC |