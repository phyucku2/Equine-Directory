import csv, io, json, re, urllib.request

def fetch(url):
    return urllib.request.urlopen(url, timeout=40).read().decode()

NAMES = "https://raw.githubusercontent.com/kjhealy/fips-codes/master/state_and_county_fips_master.csv"
CENT  = "https://raw.githubusercontent.com/btskinner/spatial/master/data/county_centers.csv"

# Lower 48 minus Florida (FL keeps its dedicated seed in prisma/seed/locations.ts
# + registry _FL_AREAS). Excludes AK, HI, DC. Centroids are approximate state
# geographic centers (low-stakes; cities get exact coords from Places).
TARGETS = {
    "AL": ("Alabama", "alabama", "01", 32.8, -86.8),
    "AZ": ("Arizona", "arizona", "04", 34.2, -111.7),
    "AR": ("Arkansas", "arkansas", "05", 34.9, -92.4),
    "CA": ("California", "california", "06", 37.0, -119.4),
    "CO": ("Colorado", "colorado", "08", 39.0, -105.5),
    "CT": ("Connecticut", "connecticut", "09", 41.6, -72.7),
    "DE": ("Delaware", "delaware", "10", 39.0, -75.5),
    "GA": ("Georgia", "georgia", "13", 32.6, -83.4),
    "ID": ("Idaho", "idaho", "16", 44.4, -114.6),
    "IL": ("Illinois", "illinois", "17", 40.0, -89.2),
    "IN": ("Indiana", "indiana", "18", 39.9, -86.3),
    "IA": ("Iowa", "iowa", "19", 42.0, -93.5),
    "KS": ("Kansas", "kansas", "20", 38.5, -98.4),
    "KY": ("Kentucky", "kentucky", "21", 37.8, -85.0),
    "LA": ("Louisiana", "louisiana", "22", 31.0, -92.0),
    "ME": ("Maine", "maine", "23", 45.4, -69.2),
    "MD": ("Maryland", "maryland", "24", 39.0, -76.7),
    "MA": ("Massachusetts", "massachusetts", "25", 42.3, -71.8),
    "MI": ("Michigan", "michigan", "26", 44.3, -85.4),
    "MN": ("Minnesota", "minnesota", "27", 46.3, -94.3),
    "MS": ("Mississippi", "mississippi", "28", 32.7, -89.7),
    "MO": ("Missouri", "missouri", "29", 38.4, -92.5),
    "MT": ("Montana", "montana", "30", 47.0, -109.6),
    "NE": ("Nebraska", "nebraska", "31", 41.5, -99.8),
    "NV": ("Nevada", "nevada", "32", 39.3, -116.6),
    "NH": ("New Hampshire", "new-hampshire", "33", 43.7, -71.6),
    "NJ": ("New Jersey", "new-jersey", "34", 40.1, -74.7),
    "NM": ("New Mexico", "new-mexico", "35", 34.4, -106.1),
    "NY": ("New York", "new-york", "36", 42.9, -75.5),
    "NC": ("North Carolina", "north-carolina", "37", 35.6, -79.4),
    "ND": ("North Dakota", "north-dakota", "38", 47.5, -100.5),
    "OH": ("Ohio", "ohio", "39", 40.3, -82.8),
    "OK": ("Oklahoma", "oklahoma", "40", 35.6, -97.5),
    "OR": ("Oregon", "oregon", "41", 44.0, -120.5),
    "PA": ("Pennsylvania", "pennsylvania", "42", 40.9, -77.8),
    "RI": ("Rhode Island", "rhode-island", "44", 41.7, -71.5),
    "SC": ("South Carolina", "south-carolina", "45", 33.9, -80.9),
    "SD": ("South Dakota", "south-dakota", "46", 44.4, -100.2),
    "TN": ("Tennessee", "tennessee", "47", 35.9, -86.4),
    "TX": ("Texas", "texas", "48", 31.5, -99.3),
    "UT": ("Utah", "utah", "49", 39.3, -111.7),
    "VT": ("Vermont", "vermont", "50", 44.1, -72.7),
    "VA": ("Virginia", "virginia", "51", 37.5, -78.8),
    "WA": ("Washington", "washington", "53", 47.4, -120.4),
    "WV": ("West Virginia", "west-virginia", "54", 38.6, -80.6),
    "WI": ("Wisconsin", "wisconsin", "55", 44.6, -89.9),
    "WY": ("Wyoming", "wyoming", "56", 43.0, -107.5),
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
