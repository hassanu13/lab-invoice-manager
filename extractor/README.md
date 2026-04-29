# DSD Lab Invoice Extractor (Python microservice)

Wraps `extract_invoice.py` in a small FastAPI service so the Next.js app
(written in TypeScript) can use the production-tested Python parsers
without re-implementing them.

## Why a separate service?

The Python ecosystem has `pdfplumber`, which extracts text _and_ tables
from PDFs in one call. The Node ecosystem doesn't have an equivalent —
attempting to reconstruct table cells from raw `pdfjs-dist` coordinates
proved fragile on real lab invoices. Three months of validated production
usage of `extract_invoice.py` is worth far more than a clean rewrite.

## Endpoints

| Method | Path       | Body                   | Returns                            |
| ------ | ---------- | ---------------------- | ---------------------------------- |
| GET    | `/health`  | —                      | `{ status: "ok" }`                 |
| POST   | `/extract` | multipart `file` (PDF) | `ExtractResponse` (camelCase JSON) |

## Run locally

```sh
cd extractor
pip install -r requirements.txt
cp ../samples/extract_invoice.py .   # if not already present
uvicorn app:app --reload --port 8000
```

Then `curl -F "file=@samples/pdfs/Hall Dental Studio.pdf" http://localhost:8000/extract`.

## Run via Docker (the normal flow)

The service is part of `infra/docker-compose.yml`, so it starts and stops
with `npm run infra:up` / `infra:down` from the repo root.
