// BFS / SECO / SNB Live Data Fetchers
// All run server-side (Vercel serverless) — no CORS restrictions apply

const BFS_PXWEB = 'https://www.pxweb.bfs.admin.ch/api/v1/de';
const TIMEOUT_MS = 20000;

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function timeout(ms) {
  return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}

async function bfsPost(tableUrl, query = []) {
  const res = await fetch(`${BFS_PXWEB}/${tableUrl}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, response: { format: 'JSON-stat2' } }),
    signal: timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`BFS ${tableUrl} → HTTP ${res.status}`);
  const jstat = await res.json();
  return parseJSONstat2(jstat);
}

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
// ──────────────────────────────────────────────
export async function fetchPopulation() {
  const rows = await bfsPost(
    'px-x-0102010000_101/px-x-0102010000_101.px',
    [
      { code: 'Kanton (-) / Bezirk (>>) / Gemeinde (......)', selection: { filter: 'item', values: ['8100'] } },
      { code: 'Bevölkerungstyp', selection: { filter: 'item', values: ['1'] } },
      { code: 'Staatsangehörigkeit (Kategorie)', selection: { filter: 'item', values: ['-99999'] } },
      { code: 'Geschlecht', selection: { filter: 'item', values: ['-99999'] } },
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
      { code: 'Jahr', selection: { filter: 'top', values: ['1'] } },
      { code: 'Grossregion', selection: { filter: 'item', values: ['0'] } },
      { code: 'Anforderungsniveau des Arbeitsplatzes', selection: { filter: 'item', values: ['0'] } },
      { code: 'Geschlecht', selection: { filter: 'item', values: ['0'] } },
    ],
  );

  // Find the Tätigkeit dimension key (handles encoding variants)
  const tatigkeitKey = Object.keys(rows[0] ?? {}).find(k =>
    k.toLowerCase().includes('t') && k.toLowerCase().includes('tigkeit') && !k.endsWith('_txt')
  ) ?? 'Tätigkeit';

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

  const filtered = rows.filter(r => r._value != null && branchenMap[r[tatigkeitKey]]);

  // If exact code matching fails, fall back to returning top rows by value
  const result = filtered.length > 0
    ? filtered.map(r => ({
        branche: branchenMap[r[tatigkeitKey]],
        value: Math.round(r._value),
        code: r[tatigkeitKey],
      }))
    : rows.filter(r => r._value != null).slice(0, 14).map(r => ({
        branche: r[`${tatigkeitKey}_txt`] ?? r[tatigkeitKey] ?? 'Unbekannt',
        value: Math.round(r._value),
        code: r[tatigkeitKey] ?? '',
      }));

  return result.sort((a, b) => b.value - a.value);
}

// ──────────────────────────────────────────────
// 3. Arbeitslosenquote nach Kanton (SECO)
//    Source: SECO Open Data (Opendatasoft API)
// ──────────────────────────────────────────────
export async function fetchUnemploymentKanton() {
  const SECO_KANTON_CODES = {
    'ZH': 'ZH', 'BE': 'BE', 'LU': 'LU', 'UR': 'UR', 'SZ': 'SZ',
    'OW': 'OW', 'NW': 'NW', 'GL': 'GL', 'ZG': 'ZG', 'FR': 'FR',
    'SO': 'SO', 'BS': 'BS', 'BL': 'BL', 'SH': 'SH', 'AR': 'AR',
    'AI': 'AI', 'SG': 'SG', 'GR': 'GR', 'AG': 'AG', 'TG': 'TG',
    'TI': 'TI', 'VD': 'VD', 'VS': 'VS', 'NE': 'NE', 'GE': 'GE', 'JU': 'JU',
  };

  const now = new Date();
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const whereClause = months.map(m => `period_ref="${m}"`).join(' OR ');

  const res = await fetch(
    `https://data.seco.admin.ch/api/explore/v2.1/catalog/datasets/ard_seco_alo_brg_kanton/records?` +
    new URLSearchParams({ limit: 200, where: whereClause, order_by: 'period_ref DESC' }),
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BFS-Statistik-Hub/1.0',
      },
      signal: timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`SECO API → HTTP ${res.status}`);
  const json = await res.json();

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
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BFS-Statistik-Hub/1.0',
      },
      signal: timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`SECO national API → HTTP ${res.status}`);
  const json = await res.json();

  return (json.results ?? []).map(r => ({
    y: r.period_ref?.slice(0, 7) ?? '',
    v: parseFloat(r.value ?? 0),
  })).filter(d => d.y && !isNaN(d.v));
}

// ──────────────────────────────────────────────
// 5. Inflation (LIK) — BFS DAM asset (CSV)
// ──────────────────────────────────────────────
export async function fetchInflation() {
  // Try current BFS DAM API endpoint for LIK Veränderungsraten
  const urls = [
    'https://dam-api.bfs.admin.ch/hub/api/dam/assets/je-d-05.02.38/master',
    'https://www.bfs.admin.ch/bfsstatic/dam/assets/je-d-05.02.38/master',
  ];

  let text = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/csv, */*' },
        signal: timeout(TIMEOUT_MS),
      });
      if (res.ok) { text = await res.text(); break; }
    } catch { /* try next */ }
  }
  if (!text) throw new Error('BFS LIK CSV not reachable');

  const lines = text.split('\n').filter(l => l.trim());
  const data = [];

  for (const line of lines.slice(1)) {
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
// 6. SNB Leitzins — SNB Data Portal (snbgwdzid cube, D0=LZ)
// ──────────────────────────────────────────────
export async function fetchSNBLeitzins() {
  // Cube snbgwdzid: interest rates incl. LZ (Leitzins/policy rate)
  const res = await fetch(
    'https://data.snb.ch/api/cube/snbgwdzid/data/csv/de?fromDate=2022-01',
    {
      headers: { 'Accept': 'text/csv, */*' },
      signal: timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`SNB API → HTTP ${res.status}`);

  const text = await res.text();
  // CSV format: "Date";"D0";"Value" with daily entries
  const lines = text.split('\n').filter(l => l.trim());

  // Find the header line
  const headerIdx = lines.findIndex(l => l.includes('"Date"') || l.startsWith('Date'));
  if (headerIdx === -1) throw new Error('SNB CSV header not found');

  const data = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = line.split(';');
    const date = (cols[0] ?? '').replace(/"/g, '').trim();
    const dim  = (cols[1] ?? '').replace(/"/g, '').trim();
    const rawV = (cols[2] ?? '').replace(/"/g, '').replace(',', '.').trim();
    const value = parseFloat(rawV);
    if (dim !== 'LZ' || !date || isNaN(value)) continue;
    data.push({ d: date.slice(0, 7), v: value });
  }

  if (data.length < 3) throw new Error('SNB CSV too short or no LZ dimension found');

  // Keep month-end value (last entry per month wins)
  const byMonth = {};
  for (const d of data) byMonth[d.d] = d.v;
  return Object.entries(byMonth)
    .map(([d, v]) => ({ d, v }))
    .sort((a, b) => a.d.localeCompare(b.d));
}

// ──────────────────────────────────────────────
// 7. Aussenhandel (EZV) — opendata.swiss CKAN
// ──────────────────────────────────────────────
export async function fetchAussenhandel() {
  // Search for the EZV Aussenhandel dataset on opendata.swiss
  const searchRes = await fetch(
    'https://opendata.swiss/api/3/action/package_search?q=aussenhandel+jahrestotale&fq=organization:ezv&rows=1',
    { signal: timeout(TIMEOUT_MS) },
  );
  if (!searchRes.ok) throw new Error(`opendata.swiss search → HTTP ${searchRes.status}`);
  const searchJson = await searchRes.json();

  // Get the first CSV resource from the first result
  const pkg = searchJson.result?.results?.[0];
  if (!pkg) throw new Error('No EZV Aussenhandel dataset found');

  const csvResource = (pkg.resources ?? []).find(r =>
    r.format?.toLowerCase() === 'csv' && r.url,
  );
  if (!csvResource) throw new Error('No CSV resource in EZV package');

  const dataRes = await fetch(csvResource.url, { signal: timeout(TIMEOUT_MS) });
  if (!dataRes.ok) throw new Error(`EZV CSV → HTTP ${dataRes.status}`);
  const text = await dataRes.text();

  // Parse CSV (semicolon or comma separated)
  const lines = text.split('\n').filter(l => l.trim());
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const header = lines[0].split(sep).map(h => h.replace(/"/g, '').trim().toLowerCase());
  const jahrIdx = header.findIndex(h => h.includes('jahr') || h.includes('year'));
  const exIdx   = header.findIndex(h => h.includes('export'));
  const imIdx   = header.findIndex(h => h.includes('import'));
  if (jahrIdx === -1 || exIdx === -1 || imIdx === -1) throw new Error('EZV CSV columns not found');

  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(c => c.replace(/"/g, '').trim());
    return {
      y:  parseInt(cols[jahrIdx]),
      ex: parseFloat(cols[exIdx]) / 1e9,
      im: parseFloat(cols[imIdx]) / 1e9,
    };
  }).filter(d => !isNaN(d.y) && !isNaN(d.ex)).sort((a, b) => a.y - b.y);
}
