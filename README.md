# DSD Lab Invoice Manager

Internal web app for Dream Smiles Dental — manages dental laboratory invoices across one to ten UK sites. Phase 1 MVP, scaffolded in Week 1.

This README is the onboarding guide for the Week 1 build. The full plan and DPIA live in `Lab_Invoice_Manager_Build_Plan.docx` and `DSD_LIM_Phase1_Kickoff_Pack.docx` in the parent folder.

## Tech stack

| Layer    | Choice                                   |
| -------- | ---------------------------------------- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| UI       | Tailwind + shadcn-style components       |
| Auth     | Email + argon2id password + TOTP MFA     |
| Database | PostgreSQL 15 (Prisma client, raw-SQL migrations) |
| Storage  | S3 (MinIO locally, AWS S3 in production) |
| Hosting  | AWS ECS Fargate, eu-west-2 (London)      |

## Prerequisites on this PC

- **Node.js 20.11+** — `node --version`
- **npm 10+** — ships with Node
- **Docker Desktop** — needed for local Postgres + MinIO
- **Git**

If any are missing:
- Node: <https://nodejs.org/en/download> (LTS, Windows installer)
- Docker Desktop: <https://www.docker.com/products/docker-desktop/>

## First-time setup

```sh
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env.local

# 3. Generate strong secrets and paste them into .env.local
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('APP_ENCRYPTION_KEY_DEV=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('PATIENT_SEARCH_HMAC_KEY=' + require('crypto').randomBytes(32).toString('base64'))"

# 4. Start Postgres + MinIO
npm run infra:up

# 5. Apply the schema (raw SQL, not `prisma migrate dev`)
#    On Windows PowerShell, you can use `docker exec` instead of psql:
docker exec -i lim-postgres psql -U lim -d lim_dev < prisma/migrations/000_initial_schema.sql

# 6. Generate Prisma client and seed the first admin
npm run db:generate
npm run db:seed

# 7. Run the app
npm run dev
```

Open <http://localhost:3000>. Sign in with `Mohammed@dreamsmilesdental.co.uk` / `ChangeMe!Dev2026` (printed by the seed script). You'll be prompted to enrol in MFA on first login.

## Daily commands

| Task                    | Command                |
| ----------------------- | ---------------------- |
| Start app               | `npm run dev`          |
| Start Postgres + MinIO  | `npm run infra:up`     |
| Stop infra              | `npm run infra:down`   |
| Type-check              | `npm run typecheck`    |
| Lint                    | `npm run lint`         |
| Tests                   | `npm test`             |
| Format                  | `npm run format`       |
| Open Prisma Studio      | `npm run db:studio`    |
| MinIO console           | <http://localhost:9001> (`minioadmin` / `minioadmin`) |

## Repo layout

```
infra/                  Docker compose for local Postgres + MinIO
prisma/
  schema.prisma         Prisma data model (mirrors the SQL below)
  migrations/000_*.sql  Source-of-truth DDL (run with psql)
  seed.ts               Local dev seed (admin user)
src/
  app/
    (auth)/             /login, /mfa, /mfa/setup
    (app)/              authenticated pages — /dashboard, /admin/*
    api/                route handlers
  components/           shared UI (DSDLogo, button, input, label)
  lib/
    auth.ts             argon2id + TOTP + lockout
    audit.ts            append-only audit log writer
    authorize.ts        requireUser, requireRole, getClientIp
    db.ts               Prisma singleton
    session.ts          server-side sessions + iron-session cookie
    utils.ts            cn, formatGBP
tests/                  vitest unit tests
.github/workflows/      CI (typecheck, lint, format-check, tests, build)
```

## Week 1 acceptance checklist

- [ ] `npm install && npm run infra:up && npm run db:seed && npm run dev` succeeds.
- [ ] You can sign in locally with email + password + TOTP MFA.
- [ ] You can create a second user as a Bolton clinician via `/admin/users/new` and that user can sign in.
- [ ] CI passes on every push.
- [ ] DPO has signed Part B (✅ done as of 28 Apr 2026).

## Outstanding (Week 1 hand-offs from you)

1. **GitHub** — push this repo to the new DSD-Tech org. Ready to go on your end ✅
2. **AWS IAM user** `dsd-lim-deploy` — not yet created. Not needed until Week 5; create when convenient.
3. **Subdomain** `labs.dreamsmilesdental.co.uk` — Route 53 / registrar DNS access by Week 5.
4. **Clinician contact details** — needed before Week 6 launch.

## Known `npm audit` warnings — review notes

After the Next.js 16 upgrade (28 Apr 2026), `npm audit` reports 7 moderate and 0 high/critical vulnerabilities. None affect production today; the rationale for each:

- **`esbuild` via `vitest`** (moderate, dev-only): the vitest dev server can be reached by any website if exposed on a public network. Only relevant when running `vitest --ui`. Fix is `vitest@4`, a breaking change — re-evaluate alongside the Phase 2 dependency refresh.
- **`postcss` via `next`** (moderate): an XSS vector when postcss stringifies untrusted CSS containing `</style>` sequences. We never stringify untrusted CSS in this app; postcss only processes our own Tailwind output at build time. The npm-suggested "fix" is `next@9.3.3`, which is a downgrade and not actually a fix. Patches itself when Next ships an updated transitive postcss.

If new production-affecting advisories land, run `npm install next@latest eslint-config-next@latest` and re-test.

## Coming next (Week 2)

- Port `extract_invoice.py` (762 LOC) to TypeScript for AWS Textract + Anthropic Claude fallback.
- Upload API + S3 storage + extraction confidence scoring.
- Validate against the 50-PDF sample from your existing `/Operations/Finance Dashboard/Lab bills/` folder.
