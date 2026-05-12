// BFS / SECO / SNB Live Data Fetchers
// All run server-side (Vercel serverless) — no CORS restrictions apply

const BFS_PXWEB = 'https://www.pxweb.bfs.admin.ch/api/v1/de';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// POST to BFS PX-Web API, returns JSON-stat2 parsed to flat row array
async function bfsPost(tableUrl, query = []) {
  const res = await fetch(`${BFS_PXWEB}/${tableUrl}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, response: { format: 'JSON-stat2' } }),
  });
  if (!res.ok) throw new Error(`BFS ${tableUrl} → HTTP ${res.status}`);
  const jstat = await res.json();
  return parseJSONstat2(jstat);
}

// Convert JSON-stat2 dataset to flat array of objects
function parseJSONstat2(jstat) {
  const ds = jstat.dataset ?? jstat;
  const dims = ds.id.map((id, i) => ({
    id,
    size: ds.size[i],
    cats: Object.entries(ds.dimension[id].category.label ?? {}),
  }));
  const values = ds.value;
  const rows = [];
  const total = dims.reduce((p, d) => p * d.size, 1);

  for (let flat = 0; flat < total; flat++) {
    let rem = flat;
    const obj = {};
    for (let di = dims.length - 1; di >= 0; di--) {
      const ci = rem % dims[di].size;
      rem = Math.floor(rem / dims[di].size);
      obj[dims[di].id] = dims[di].cats[ci]?.[0] ?? String(ci);
      obj[`${dims[di].id}_txt`] = dims[di].cats[ci]?.[1] ?? String(ci);
    }
    obj._value = values[flat];
    rows.push(obj);
  }
  return rows;
}

// ──────────────────────────────────────────────
// 1. Wohnbevölkerung (STATPOP)
//    BFS PX-Web: px-x-0102010000_101
//    Confirmed working — variable codes verified
// ──────────────────────────────────────────────
export async function fetchPopulation() {
  const rows = await bfsPost(
    'px-x-0102010000_101/px-x-0102010000_101.px',
    [
      // Switzerland total
      { code: 'Kanton (-) / Bezirk (>>) / Gemeinde (......)', selection: { filter: 'item', values: ['8100'] } },
      // Ständige Wohnbevölkerung only
      { code: 'Bevölkerungstyp', selection: { filter: 'item', values: ['1'] } },
      // Total nationality
      { code: 'Staatsangehörigkeit (Kategorie)', selection: { filter: 'item', values: ['-99999'] } },
      // Total gender
      { code: 'Geschlecht', selection: { filter: 'item', values: ['-99999'] } },
      // Total age
      { code: 'Alter', selection: { filter: 'item', values: ['-99999'] } },
    ],
  );

  return rows
    .filter(r => r._value != null)
    .map(r => ({ y: parseInt(r['Jahr']), v: Math.round(r._value) / 1e6 }))
    .sort((a, b) => a.y - b.y);
}

// ──────────────────────────────────────────────
// 2. Medianlohn nach Branche (LSE)
//    BFS PX-Web: px-x-0304010000_101
// ──────────────────────────────────────────────
export async function fetchWages() {
  const rows = await bfsPost(
    'px-x-0304010000_101/px-x-0304010000_101.px',
    [
      // Latest year only (top 1)
      { code: 'Jahr', selection: { filter: 'top', values: ['1'] } },
      // All grossregions → pick Gesamtschweiz (code 0)
      { code: 'Grossregion', selection: { filter: 'item', values: ['0'] } },
      // All sectors (act, 10–38, serv, tot)
      // All Anforderungsniveaus → total (0)
      { code: 'Anforderungsniveau des Arbeitsplatzes', selection: { filter: 'item', values: ['0'] } },
      // Geschlecht total (0)
      { code: 'Geschlecht', selection: { filter: 'item', values: ['0'] } },
    ],
  );

  const branchenMap = {
    'tot':  'Total Wirtschaft',
    'act':  'Privatwirtschaft',
    '10':   'Industrie',
    '20':   'Bau',
    'serv': 'Dienstleistungen',
    '21':   'Handel',
    '22':   'Gastgewerbe',
    '23':   'Transport',
    '24':   'Finanz & Versicherung',
    '25':   'IT & Information',
    '26':   'Fachliche Dienstl.',
    '27':   'Öff. Verwaltung',
    '28':   'Bildung',
    '29':   'Gesundheit',
  };

  return rows
    .filter(r => r._value != null && branchenMap[r['Tätigkeit']])
    .map(r => ({
      branche: branchenMap[r['Tätigkeit']],
      value: Math.round(r._value),
      code: r['Tätigkeit'],
    }))
    .sort((a, b) => b.value - a.value);
}

// ──────────────────────────────────────────────
// 3. Arbeitslosenquote nach Kanton (SECO)
//    Source: SECO Open Data (Opendatasoft API)
//    Dataset: ard_seco_alo_brg_kanton
// ──────────────────────────────────────────────
export async function fetchUnemploymentKanton() {
  // Map SECO municipality keys → canton ISO codes
  const SECO_KANTON_CODES = {
    'ZH': 'ZH', 'BE': 'BE', 'LU': 'LU', 'UR': 'UR', 'SZ': 'SZ',
    'OW': 'OW', 'NW': 'NW', 'GL': 'GL', 'ZG': 'ZG', 'FR': 'FR',
    'SO': 'SO', 'BS': 'BS', 'BL': 'BL', 'SH': 'SH', 'AR': 'AR',
    'AI': 'AI', 'SG': 'SG', 'GR': 'GR', 'AG': 'AG', 'TG': 'TG',
    'TI': 'TI', 'VD': 'VD', 'VS': 'VS', 'NE': 'NE', 'GE': 'GE', 'JU': 'JU',
  };

  // Determine current and previous month for "latest available"
  const now = new Date();
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const whereClause = months.map(m => `period_ref="${m}"`).join(' OR ');

  const res = await fetch(
    `https://data.seco.admin.ch/api/explore/v2.1/catalog/datasets/ard_seco_alo_brg_kanton/records?` +
    new URLSearchParams({ limit: 200, where: whereClause, order_by: 'period_ref DESC' }),
    { headers: { 'Accept': 'application/json' } },
  );
  if (!res.ok) throw new Error(`SECO API → HTTP ${res.status}`);
  const json = await res.json();

  // Collect latest value per canton
  const latest = {};
  for (const r of (json.results ?? [])) {
    const code = SECO_KANTON_CODES[r.ggr_kz] ?? SECO_KANTON_CODES[r.kanton_code] ?? r.ggr_kz;
    if (!code) continue;
    if (!latest[code] || r.period_ref > latest[code].period_ref) {
      latest[code] = r;
    }
  }

  const result = Object.entries(latest).map(([code, r]) => ({
    code,
    name: r.ggr_label_de ?? r.kanton_name ?? code,
    value: parseFloat(r.value ?? r.quote ?? 0),
    period: r.period_ref,
  })).filter(d => !isNaN(d.value));

  if (result.length < 20) throw new Error(`Only ${result.length} cantons returned — expected 26`);
  return result;
}

// ──────────────────────────────────────────────
// 4. Arbeitslosenquote Zeitreihe CH (SECO national)
// ──────────────────────────────────────────────
export async function fetchUnemploymentTimeline() {
  const res = await fetch(
    `https://data.seco.admin.ch/api/explore/v2.1/catalog/datasets/ard_seco_alo_national/records?` +
    new URLSearchParams({ limit: 200, order_by: 'period_ref ASC', where: 'period_ref > "2014-12"' }),
    { headers: { 'Accept': 'application/json' } },
  );
  if (!res.ok) throw new Error(`SECO national API → HTTP ${res.status}`);
  const json = await res.json();

  return (json.results ?? []).map(r => ({
    y: r.period_ref?.slice(0, 7) ?? '',
    v: parseFloat(r.value ?? 0),
  })).filter(d => d.y && !isNaN(d.v));
}

// ──────────────────────────────────────────────
// 5. Inflation (LIK) — BFS Jahrestotal asset
//    BFS publishes LIK as JSON through their key-figures API
//    Endpoint: BFS Linked Open Statistical Data (LOSD)
// ──────────────────────────────────────────────
export async function fetchInflation() {
  // BFS LOSD endpoint for LIK (Gesamtindex, YoY, monthly)
  // The dataset ID is je-d-05.02.38 (LIK-Veränderungsraten)
  const res = await fetch(
    'https://www.bfs.admin.ch/bfsstatic/dam/assets/je-d-05.02.38/master',
    { headers: { 'Accept': 'application/json, text/csv, */*' } },
  );
  if (!res.ok) throw new Error(`BFS LIK asset → HTTP ${res.status}`);

  const text = await res.text();
  // The BFS CSV format: typically semicolon-separated
  const lines = text.split('\n').filter(l => l.trim());
  const data = [];

  for (const line of lines.slice(1)) { // skip header
    const parts = line.split(';');
    const period = (parts[0] ?? '').replace(/"/g, '').trim();
    const value = parseFloat((parts[1] ?? '').replace(/"/g, '').replace(',', '.'));
    if (period && !isNaN(value)) {
      data.push({ m: period, v: value });
    }
  }

  if (data.length < 5) throw new Error('LIK CSV too short — check URL/format');
  return data.sort((a, b) => a.m.localeCompare(b.m));
}

// ──────────────────────────────────────────────
// 6. SNB Leitzins — SNB Data Portal CSV
// ──────────────────────────────────────────────
export async function fetchSNBLeitzins() {
  // SNB publishes their policy rate history as a downloadable CSV
  // Dataset: Interest rates and yields — SNB policy rate
  const res = await fetch(
    'https://data.snb.ch/api/cube/snbpol/data/csv/de?startPeriod=2022-01',
    { headers: { 'Accept': 'text/csv, */*' } },
  );
  if (!res.ok) throw new Error(`SNB API → HTTP ${res.status}`);

  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('"D0'));
  const data = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(';');
    const date = (cols[0] ?? '').replace(/"/g, '').trim();
    const value = parseFloat((cols[1] ?? '').replace(/"/g, '').replace(',', '.'));
    if (date && !isNaN(value)) {
      data.push({ d: date.slice(0, 7), v: value });
    }
  }

  if (data.length < 3) throw new Error('SNB CSV too short');
  // Keep only month-end values (dedup by month)
  const byMonth = {};
  for (const d of data) byMonth[d.d] = d.v;
  return Object.entries(byMonth)
    .map(([d, v]) => ({ d, v }))
    .sort((a, b) => a.d.localeCompare(b.d));
}

// ──────────────────────────────────────────────
// 7. Aussenhandel (EZV/Eidg. Zollverwaltung)
//    Source: opendata.swiss CKAN, Aussenhandel dataset
// ──────────────────────────────────────────────
export async function fetchAussenhandel() {
  // This fetches the latest annual totals for exports and imports
  const res = await fetch(
    'https://opendata.swiss/api/3/action/datastore_search?' +
    new URLSearchParams({
      resource_id: 'aussenhandel-jahrestotale',
      limit: 20,
      sort: 'Jahr desc',
    }),
    { headers: { 'Accept': 'application/json' } },
  );
  if (!res.ok) throw new Error(`EZV Aussenhandel → HTTP ${res.status}`);
  const json = await res.json();

  return (json.result?.records ?? []).map(r => ({
    y: parseInt(r.Jahr),
    ex: parseFloat(r.Exporte ?? 0) / 1e9, // in Mrd CHF
    im: parseFloat(r.Importe ?? 0) / 1e9,
  })).filter(d => !isNaN(d.y) && !isNaN(d.ex)).sort((a, b) => a.y - b.y);
}
