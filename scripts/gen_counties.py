import csv, io, json, re, urllib.request

def fetch(url):
    return urllib.request.urlopen(url, timeout=40).read().decode()

NAMES = "https://raw.githubusercontent.com/kjhealy/fips-codes/master/state_and_county_fips_master.csv"
CENT  = "https://raw.githubusercontent.com/btskinner/spatial/master/data/county_centers.csv"

TARGETS = {
    "TX": ("Texas", "texas", "48", 31.0, -99.0),
    "CA": ("California", "california", "06", 37.0, -119.4),
    "KY": ("Kentucky", "kentucky", "21", 37.8, -85.0),
    "GA": ("Georgia", "georgia", "13", 32.6, -83.4),
    "NC": ("North Carolina", "north-carolina", "37", 35.6, -79.4),
}

# centroid by 5-digit fips
cent = {}
for row in csv.DictReader(io.StringIO(fetch(CENT))):
    try:
        cent[row["fips"].zfill(5)] = (float(row["clat10"]), float(row["clon10"]))
    except (ValueError, KeyError):
        continue

def slugify(name):
    s = re.sub(r"\s+county$", "", name.strip(), flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

by_state = {k: [] for k in TARGETS}
for row in csv.DictReader(io.StringIO(fetch(NAMES))):
    st = row["state"].strip()
    name = row["name"].strip()
    if st not in TARGETS or not name.lower().endswith("county"):
        continue
    fips5 = row["fips"].zfill(5)
    coord = cent.get(fips5)
    if not coord:
        continue
    lat, lng = coord
    by_state[st].append({
        "name": name, "slug": slugify(name),
        "fips": fips5[2:],  # 3-digit county fips
        "lat": round(lat, 4), "lng": round(lng, 4),
    })

for st in by_state:
    by_state[st].sort(key=lambda c: c["name"])
    print(f"{st}: {len(by_state[st])} counties")

# ---- TS seed file ----
ts = io.StringIO()
ts.write("// AUTO-GENERATED national county seed (US Census FIPS + 2010 county centroids).\n")
ts.write("// Source: kjhealy/fips-codes + btskinner/spatial. Do not hand-edit; regenerate.\n")
ts.write("import type { CountySeed } from \"./locations\";\n\n")
ts.write("export interface StateSeed { name: string; slug: string; code: string; lat: number; lng: number; }\n\n")
ts.write("export const US_STATES: StateSeed[] = [\n")
for code, (nm, slug, _f, lat, lng) in TARGETS.items():
    ts.write(f'  {{ name: "{nm}", slug: "{slug}", code: "{code}", lat: {lat}, lng: {lng} }},\n')
ts.write("];\n\n")
ts.write("// county lists keyed by state code\n")
ts.write("export const US_COUNTIES: Record<string, CountySeed[]> = {\n")
for st, rows in by_state.items():
    ts.write(f'  {st}: [\n')
    for c in rows:
        ts.write(f'    {{ name: "{c["name"]}", slug: "{c["slug"]}", fips: "{c["fips"]}", lat: {c["lat"]}, lng: {c["lng"]} }},\n')
    ts.write("  ],\n")
ts.write("};\n")
open("web/prisma/seed/us-counties.ts", "w").write(ts.getvalue())

# ---- Python crawler areas ----
py = io.StringIO()
py.write('"""AUTO-GENERATED Places search areas per state (US Census county names).\n')
py.write('Regenerate via scratchpad/gen_counties.py. Each string is one billable\n')
py.write('Places call per query phrase."""\n\n')
py.write("from __future__ import annotations\n\n")
py.write("STATE_META: dict[str, dict] = {\n")
for code, (nm, slug, _f, lat, lng) in TARGETS.items():
    py.write(f'    "{code}": {{"name": "{nm}", "slug": "{slug}", "lat": {lat}, "lng": {lng}}},\n')
py.write("}\n\n")
py.write("STATE_COUNTY_AREAS: dict[str, list[str]] = {\n")
for st, rows in by_state.items():
    py.write(f'    "{st}": [\n')
    line = "        "
    for c in rows:
        tok = f'"{c["name"]} {st}", '
        if len(line) + len(tok) > 96:
            py.write(line.rstrip() + "\n"); line = "        "
        line += tok
    py.write(line.rstrip() + "\n    ],\n")
py.write("}\n")
open("crawler/equine_crawler/us_counties.py", "w").write(py.getvalue())

total = sum(len(v) for v in by_state.values())
print(f"TOTAL: {total} counties across {len(by_state)} states")
print("wrote web/prisma/seed/us-counties.ts and crawler/equine_crawler/us_counties.py")
