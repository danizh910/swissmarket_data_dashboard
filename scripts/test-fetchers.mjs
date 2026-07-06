// Smoke-Test für alle Live-Daten-Fetcher: node scripts/test-fetchers.mjs
// Läuft ohne DB — prüft nur, ob die externen Quellen erreichbar sind und
// plausible Daten liefern. Exit-Code 1, wenn mindestens eine Quelle bricht.
import {
  fetchPopulation,
  fetchWages,
  fetchUnemploymentTimeline,
  fetchInflation,
  fetchSNBLeitzins,
  fetchAussenhandel,
} from '../lib/fetchers.js';

const tests = {
  fetchPopulation,
  fetchWages,
  fetchUnemploymentTimeline,
  fetchInflation,
  fetchSNBLeitzins,
  fetchAussenhandel,
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  const t0 = Date.now();
  try {
    const data = await fn();
    const n = Array.isArray(data) ? data.length : 1;
    const last = Array.isArray(data) ? JSON.stringify(data.at(-1)) : JSON.stringify(data);
    console.log(`✓ ${name.padEnd(26)} ${String(n).padStart(4)} rows  ${Date.now() - t0}ms  last=${last}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name.padEnd(26)} FAIL (${Date.now() - t0}ms): ${err.message}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
