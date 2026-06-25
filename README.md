# Equine Directory

The most trusted, comprehensive directory of equine businesses and services —
barns, stables, boarding, training, feed & tack stores, veterinary care,
transportation, cleaning, farriers, and more. **Florida-first, expanding
nationwide.**

## Repository structure

| Path     | Description                                                        |
| -------- | ------------------------------------------------------------------ |
| `web/`   | Next.js 15 (App Router, TypeScript, Tailwind) frontend on Vercel.  |
| `crawler/` | Python data pipeline using [`crawl4ai`](https://github.com/unclecode/crawl4ai) to seed listings. |
| `specs/` | Speckit-style specs: `constitution.md`, `spec.md`, `plan.md`, `tasks.md`. |

## Tech stack

- **Web:** Next.js 15, TypeScript, Tailwind CSS, Prisma, PostgreSQL — deployed on Vercel.
- **Crawler:** Python 3.11, `crawl4ai`, async crawling → structured listing records → Postgres.

## Status

🚧 Under active development via an autonomous build loop. See `specs/` for the
roadmap and `specs/tasks.md` for the live task list.

## Getting started

```bash
# Web
cd web && npm install && npm run dev

# Crawler
cd crawler && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```
