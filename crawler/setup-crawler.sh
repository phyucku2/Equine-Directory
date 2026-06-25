#!/usr/bin/env bash
# On-demand crawler setup: a Python virtualenv with the pipeline + LLM deps.
# Kept out of the SessionStart hook because the installs are heavy; run it
# before a live crawl (or whenever crawler/.venv is missing).
#
#   bash crawler/setup-crawler.sh
#   crawler/.venv/bin/python crawler/run.py --source fixtures
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -d .venv ]; then
  echo "[crawler] creating virtualenv..."
  python3 -m venv .venv
fi

echo "[crawler] installing dependencies..."
.venv/bin/pip install -q --upgrade pip
# Core pipeline deps (always). crawl4ai is only needed for LIVE web crawls and
# pulls in Playwright; install it explicitly when crawling real sites.
.venv/bin/pip install -q \
  'psycopg[binary]>=3.2' 'pydantic>=2.7' 'python-dotenv>=1.0' 'tenacity>=8.3' \
  'google-genai>=1.0' 'anthropic>=0.40'

echo "[crawler] done. Run:  crawler/.venv/bin/python crawler/run.py --source fixtures"
echo "[crawler] for live web crawls also:  .venv/bin/pip install crawl4ai && .venv/bin/playwright install chromium"
