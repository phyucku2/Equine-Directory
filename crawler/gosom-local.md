# Running the gosom scraper locally (Docker)

Self-hosted Google Maps scraping with [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper):
no 20-result cap, $0/record, your residential IP (less blocking). Output JSON →
ingested into Neon through our pipeline (`--source gmaps-file`).

## ⏰ Scheduled run — California (turnkey)

The CA query list is **pre-generated and committed** as `queries-ca.txt` (162
queries — 54 dense counties × 3 phrases), so there's no gen step. At run time:

1. **Open Docker Desktop** and wait for the whale icon to go green. *(Required —
   step 2 talks to the Docker daemon. The ingest in step 3 does not need Docker.)*
2. Set your Neon URL once in the shell, then run the two commands:

```powershell
cd C:\path\to\Equine-Directory\crawler
git pull
$env:DATABASE_URL = "postgresql://...your-neon-url..."

# 1) Scrape CA (uses the committed queries-ca.txt)
docker run --rm `
  -v gmaps-cache:/opt `
  -v "${PWD}/queries-ca.txt:/queries.txt:ro" `
  -v "${PWD}/out:/out" `
  gosom/google-maps-scraper `
  -input /queries.txt -results /out/results-ca.json -json -depth 20 -c 8 -exit-on-inactivity 3m

# 2) Ingest into Neon (geocode, grade, dedup, facet pre-fill, moderation)
python run.py --source gmaps-file --file out/results-ca.json --no-llm
```

**macOS / Linux:** `export DATABASE_URL="..."` and use `$PWD` with forward slashes.

CA on a home IP is ~30–45 min at `-c 8`. **Paste the `done: …` line back to Claude**
to read the lift. If you get *0 results / blocked*, lower `-c` to `4` or add proxies
(see Tips). Other states: `python gen_gmaps_queries.py --dense --state NC --out queries-nc.txt`
(swap `NC`/`GA`/`TX`/`FL`).

## Prerequisites (one-time)
- **Docker Desktop** installed and **running**.
- **Python 3** (`pip install -r requirements.txt` in this folder).
- Repo on the **`main`** branch (`git pull`) — has the gosom pipeline.
- Your **Neon `DATABASE_URL`** (Neon dashboard → Connection Details, or Vercel → env vars).

## Steps (Windows PowerShell — run from the `crawler` folder)

```powershell
cd C:\path\to\Equine-Directory\crawler
git pull
pip install -r requirements.txt
$env:DATABASE_URL = "postgresql://...your-neon-url..."

# 1) Build the query list. Start with ONE state to validate.
python gen_gmaps_queries.py --dense --state FL --out queries.txt    # ~189 queries
#   national dense (all 5 done states): python gen_gmaps_queries.py --dense --out queries.txt
#   a whole state (all counties):       python gen_gmaps_queries.py --state TX --out queries.txt

# 2) Run gosom (depth 20 scrolls past the 20-cap)
docker run --rm `
  -v gmaps-cache:/opt `
  -v "${PWD}/queries.txt:/queries.txt:ro" `
  -v "${PWD}/out:/out" `
  gosom/google-maps-scraper `
  -input /queries.txt -results /out/results.json -json -depth 20 -c 8 -exit-on-inactivity 3m

# 3) Ingest into Neon (geocode, grade, dedup, facet pre-fill, moderation)
python run.py --source gmaps-file --file out/results.json --no-llm
```

**macOS / Linux:** same, but `export DATABASE_URL="..."` and use `$PWD` with forward slashes.

## What you get
The ingest prints: `done: X created, Y updated, Z skipped | … published … review`.
- `created` = net-new barns gosom found beyond our Google data
- `updated` = matched existing
**Paste that `done:` line to Claude** to read the lift.

## Tips
- **Start with FL** (`--dense --state FL`) to confirm gosom isn't blocked before a big run.
- **Scale / blocking:** for many states add residential proxies: append
  `-proxies 'socks5://user:pass@host:port,...'` to the docker command. One state on a home IP is usually fine bare.
- **Throughput:** ~120 places/min at `-c 8`; a dense state is ~20–40 min.
- **Dedup nuance:** gosom returns Google's CID (≠ the Places API place_id), so dedup
  falls back to name/slug/phone/website matching — a few near-dupes may slip; we can add a cleanup pass.

## Troubleshooting
- *"Cannot connect to the Docker daemon"* → Docker Desktop isn't running. Launch it, wait for green.
- *Volume/path error on Windows* → use the full path instead of `${PWD}`, e.g. `-v "C:/Users/you/.../crawler/queries.txt:/queries.txt:ro"`.
- *0 results / blocked* → you're being throttled; lower `-c` to `4`, or add proxies.
- *DB connection error on ingest* → check `DATABASE_URL` is set in the same shell.
