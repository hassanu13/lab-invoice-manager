# Local infra

Two services, both run via Docker Compose:

| Service  | Port       | Purpose                                |
| -------- | ---------- | -------------------------------------- |
| Postgres | 5432       | App database (mirrors AWS RDS target)  |
| MinIO    | 9000, 9001 | S3-compatible storage for PDF uploads  |

## Start

```sh
npm run infra:up
```

First run creates the `dsd-lim-dev` bucket automatically.

## Apply schema

```sh
# Run the raw-SQL migration once Postgres is up:
psql "postgresql://lim:lim_dev_password@localhost:5432/lim_dev" \
  -f prisma/migrations/000_initial_schema.sql

# Generate the Prisma client and seed an admin user:
npm run db:generate
npm run db:seed
```

## MinIO console

Open <http://localhost:9001> — login `minioadmin` / `minioadmin`.

## Stop

```sh
npm run infra:down
```

Data persists under `infra/data/`. Delete that folder for a clean reset.
