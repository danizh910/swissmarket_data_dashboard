// BFS / SECO / SNB Live Data Fetchers
// All run server-side (Vercel serverless) — no CORS restrictions apply

const BFS_PXWEB = 'https://www.pxweb.bfs.admin.ch/api/v1/de';
const TIMEOUT_MS = 25000;
const UA = 'BFS-Statistik-Hub/1.0 (+https://github.com/danizh910/swissmarket_data_dashboard)';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function timeout(ms) {
  return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined;
}

// PX-Web can be slow on cold cache — retry once before giving up
async function bfsPost(tableUrl, query = [], attempt = 1) {
  try {
    const res = await fetch(`${BFS_PXWEB}/${tableUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query, response: { format: 'JSON-stat2' } }),
      signal: timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`BFS ${tableUrl} → HTTP ${res.status}`);
    const jstat = await res.json();
    return parseJSONstat2(jstat);
  } catch (err) {
    if (attempt < 2) return bfsPost(tableUrl, query, attempt + 1);
    throw err;
  }
}

// SNB data portal CSV → [{date, dims: [..], value}]
// Format: "Date";"D0"[;"D1";...];"Value" with quoted fields
// dimSel z.B. 'D0(A,E),D1(GT)' — ohne dimSel liefert die API nur die Default-Auswahl!
async function snbCsv(cubeId, fromDate, dimSel = '') {
  const sel = dimSel ? `&dimSel=${encodeURIComponent(dimSel)}` : '';
  const res = await fetch(
    `https://data.snb.ch/api/cube/${cubeId}/data/csv/de?fromDate=${fromDate}${sel}`,
    { headers: { 'Accept': 'text/csv, */*', 'User-Agent': UA }, signal: timeout(TIMEOUT_MS) },
  );
  if (!res.ok) throw new Error(`SNB ${cubeId} → HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter(l => l.trim());
  const headerIdx = lines.findIndex(l => l.includes('"Date"') || l.startsWith('Date'));
  if (headerIdx === -1) throw new Error(`SNB ${cubeId}: CSV header not found`);

  const rows = [];
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = line.split(';').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 3) continue;
    const value = parseFloat(cols[cols.length - 1].replace(',', '.'));
    if (!cols[0] || isNaN(value)) continue;
    rows.push({ date: cols[0], dims: cols.slice(1, -1), value });
  }
  if (rows.length === 0) throw new Error(`SNB ${cubeId}: no data rows`);
  return rows;
}

function parseJSONstat2(jstat) {
  const ds = jstat.dataset ?? jstat;
  const dims = ds.id.map((id, i) => {
    // Reihenfolge MUSS aus category.index kommen — die Key-Reihenfolge von
    // category.label ist nicht garantiert und führte zu vertauschten Werten.
    const cat = ds.dimension[id].category ?? {};
    let codes;
    if (Array.isArray(cat.index)) codes = cat.index;
    else if (cat.index && typeof cat.index === 'object') {
      codes = Object.entries(cat.index).sort((a, b) => a[1] - b[1]).map(([c]) => c);
    } else {
      codes = Object.keys(cat.label ?? {});
    }
    return {
      id,
      size: ds.size[i],
      cats: codes.map(c => [c, cat.label?.[c] ?? c]),
    };
  });
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
// 2. Medianlohn nach Wirtschaftsabteilung (LSE)
//    BFS PX-Web: px-x-0304010000_201 (aktuell, Jahre bis 2024)
//    Die alte Tabelle px-x-0304010000_101 endet 2010!
// ──────────────────────────────────────────────
export async function fetchWages() {
  // NOGA-Abteilungen → Anzeigename (kurz, dashboard-tauglich)
  const BRANCHEN = {
    '-1': 'Total Wirtschaft',
    '21': 'Pharma',
    '64': 'Banken',
    '65': 'Versicherungen',
    '62': 'IT-Dienstleistungen',
    '72': 'Forschung & Entwicklung',
    '28': 'Maschinenbau',
    '26': 'Elektronik & Uhren',
    '41': 'Baugewerbe',
    '46': 'Grosshandel',
    '47': 'Detailhandel',
    '86': 'Gesundheitswesen',
    '85': 'Bildung',
    '84': 'Öff. Verwaltung',
    '56': 'Gastronomie',
  };

  const rows = await bfsPost(
    'px-x-0304010000_201/px-x-0304010000_201.px',
    [
      { code: 'Jahr', selection: { filter: 'top', values: ['1'] } },
      { code: 'Grossregion', selection: { filter: 'item', values: ['-1'] } },
      { code: 'Wirtschaftsabteilung', selection: { filter: 'item', values: Object.keys(BRANCHEN) } },
      { code: 'Berufliche Stellung', selection: { filter: 'item', values: ['-1'] } },
      { code: 'Geschlecht', selection: { filter: 'item', values: ['-1'] } },
      { code: 'Zentralwert und andere Perzentile', selection: { filter: 'item', values: ['1'] } },
    ],
  );

  const result = rows
    .filter(r => r._value != null && BRANCHEN[r['Wirtschaftsabteilung']])
    .map(r => ({
      branche: BRANCHEN[r['Wirtschaftsabteilung']],
      value: Math.round(r._value),
      // Frontend erwartet 'tot' als Code für das Gesamttotal
      code: r['Wirtschaftsabteilung'] === '-1' ? 'tot' : r['Wirtschaftsabteilung'],
      year: r['Jahr'],
    }))
    .sort((a, b) => b.value - a.value);

  if (result.length < 5) throw new Error(`LSE: only ${result.length} branches returned`);
  const year = parseInt(result[0].year);
  if (!year || year < 2016) throw new Error(`LSE: unexpected year ${result[0].year}`);
  return result;
}

// ──────────────────────────────────────────────
// 3. Arbeitslosenquote Zeitreihe CH — SNB Datenportal
//    Cube amarbma (Quelle: SECO), D0=T1 = Arbeitslosenquote Total
//    Hinweis: das frühere SECO-Portal data.seco.admin.ch existiert
//    nicht mehr (NXDOMAIN seit 2026) — SNB spiegelt dieselben Daten.
// ──────────────────────────────────────────────
export async function fetchUnemploymentTimeline() {
  const rows = await snbCsv('amarbma', '2015-01', 'D0(T1)');
  const data = rows
    .filter(r => r.dims[0] === 'T1')
    .map(r => ({ y: r.date.slice(0, 7), v: +r.value.toFixed(2) }))
    .sort((a, b) => a.y.localeCompare(b.y));
  if (data.length < 24) throw new Error(`SNB amarbma: only ${data.length} months`);
  return data;
}

// ──────────────────────────────────────────────
// 5. Inflation (LIK) — BFS DAM Excel (XLSX)
//    contentId 335156:latest:de = current month detail table
//    Returns [{m: 'YYYY-MM', v: yoyPct}] for the current month only.
//    refresh.js merges this into the existing DB time series.
// ──────────────────────────────────────────────
export async function fetchInflation() {
  const url = 'https://dam-api.bfs.admin.ch/hub/api/dam/assets/335156:latest:de/master';
  const res = await fetch(url, { signal: timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`BFS LIK Excel → HTTP ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  const { read, utils } = await import('xlsx');
  const wb = read(buf, { type: 'buffer' });
  const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });

  // Find header row containing '% m-12' (YoY change column)
  let headerIdx = -1, yoyCol = -1;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const j = rows[i].findIndex(c => c === '% m-12');
    if (j !== -1) { headerIdx = i; yoyCol = j; break; }
  }
  if (yoyCol === -1) throw new Error('LIK Excel: % m-12 column not found');

  // The current month is the largest Excel date serial (~46000) in the header row
  const headerRow = rows[headerIdx];
  const monthSerial = Math.max(
    0,
    ...headerRow.slice(0, yoyCol).filter(c => typeof c === 'number' && c > 44000 && c < 50000),
  );
  if (!monthSerial) throw new Error('LIK Excel: month serial not found in header');

  // Excel serial → YYYY-MM  (25569 = Unix epoch offset; use UTC to avoid DST)
  const d = new Date((monthSerial - 25569) * 86400 * 1000);
  const m = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

  // Find Total row: Level == 1 and Position_D == 'Total'
  let yoyValue = null;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    if (row[3] == 1 && (row[5] === 'Total' || String(row[0]).startsWith('100_100'))) {
      const v = parseFloat(String(row[yoyCol] ?? '').replace(',', '.'));
      if (!isNaN(v)) { yoyValue = v; break; }
    }
  }
  if (yoyValue === null) throw new Error('LIK Excel: Total YoY value not found');

  return [{ m, v: yoyValue }];
}

// ──────────────────────────────────────────────
// 6. SNB Leitzins — SNB Datenportal (snbgwdzid cube, D0=LZ)
// ──────────────────────────────────────────────
export async function fetchSNBLeitzins() {
  const rows = await snbCsv('snbgwdzid', '2022-01', 'D0(LZ)');
  const lz = rows.filter(r => r.dims[0] === 'LZ');
  if (lz.length < 3) throw new Error('SNB snbgwdzid: no LZ dimension found');

  // Keep month-end value (last entry per month wins)
  const byMonth = {};
  for (const r of lz) byMonth[r.date.slice(0, 7)] = r.value;
  return Object.entries(byMonth)
    .map(([d, v]) => ({ d, v }))
    .sort((a, b) => a.d.localeCompare(b.d));
}

// ──────────────────────────────────────────────
// 7. Aussenhandel — SNB Datenportal
//    Cube ausshawarm (Quelle: BAZG): D0 A/E/H, D1=GT Total, D2=WMF Wert Mio CHF
//    Aggregiert auf Jahrestotale (nur vollständige Jahre) in Mrd CHF.
// ──────────────────────────────────────────────
export async function fetchAussenhandel() {
  const rows = await snbCsv('ausshawarm', '2015-01', 'D0(A,E),D1(GT),D2(WMF)');
  const byYear = {};
  for (const r of rows) {
    const [d0, d1, d2] = r.dims;
    if (d1 !== 'GT' || d2 !== 'WMF' || (d0 !== 'A' && d0 !== 'E')) continue;
    const y = parseInt(r.date.slice(0, 4));
    byYear[y] ??= { ex: 0, im: 0, months: new Set() };
    byYear[y][d0 === 'A' ? 'ex' : 'im'] += r.value;
    byYear[y].months.add(r.date.slice(0, 7));
  }

  const data = Object.entries(byYear)
    .filter(([, v]) => v.months.size === 12)   // nur vollständige Jahre
    .map(([y, v]) => ({ y: parseInt(y), ex: +(v.ex / 1000).toFixed(1), im: +(v.im / 1000).toFixed(1) }))
    .sort((a, b) => a.y - b.y);

  if (data.length < 3) throw new Error(`SNB ausshawarm: only ${data.length} complete years`);
  return data;
}
