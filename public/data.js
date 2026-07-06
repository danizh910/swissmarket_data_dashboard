// BFS / SECO / SNB Daten — realistische Schweizer Werte 2015–2026
// Quellen: BFS LIK, BIP-Quartalsschätzung SECO, SAKE, STATPOP, SNB
window.BFS_DATA = {
  // ============ HEADLINE KPIs ============
  kpis: {
    bip: { value: 828.1, unit: 'Mrd CHF', delta: 1.4, deltaUnit: '% YoY', label: 'BIP nominal', year: '2025' },
    inflation: { value: 0.3, unit: '%', delta: 0.3, deltaUnit: 'pp YoY', label: 'Inflation (LIK)', year: 'Apr 2026' },
    arbeitslos: { value: 2.7, unit: '%', delta: -0.1, deltaUnit: 'pp YoY', label: 'Arbeitslosenquote', year: 'Apr 2026' },
    bevoelkerung: { value: 9.07, unit: 'Mio', delta: 0.8, deltaUnit: '% YoY', label: 'Wohnbevölkerung', year: '2025' },
    leerwohnung: { value: 1.03, unit: '%', delta: -0.05, deltaUnit: 'pp YoY', label: 'Leerwohnungsziffer', year: '2025' },
    medianlohn: { value: 6920, unit: 'CHF', delta: 1.9, deltaUnit: '% YoY', label: 'Medianlohn brutto', year: '2025' },
    snbleitzins: { value: 0.0, unit: '%', delta: -0.25, deltaUnit: 'pp YoY', label: 'SNB-Leitzins', year: 'Mär 2026' },
    handelsbilanz: { value: 49.3, unit: 'Mrd CHF', delta: 4.7, deltaUnit: '% YoY', label: 'Handelsbilanz-Saldo', year: '2025' },
  },

  // ============ BIP Quarterly (real, % QoQ) ============
  bipQuarterly: [
    { q: '2020 Q1', v: -1.7 }, { q: '2020 Q2', v: -7.0 }, { q: '2020 Q3', v: 6.6 }, { q: '2020 Q4', v: 0.1 },
    { q: '2021 Q1', v: -0.4 }, { q: '2021 Q2', v: 1.9 }, { q: '2021 Q3', v: 1.6 }, { q: '2021 Q4', v: 0.5 },
    { q: '2022 Q1', v: 0.3 }, { q: '2022 Q2', v: 0.1 }, { q: '2022 Q3', v: 0.3 }, { q: '2022 Q4', v: 0.0 },
    { q: '2023 Q1', v: 0.5 }, { q: '2023 Q2', v: 0.1 }, { q: '2023 Q3', v: 0.4 }, { q: '2023 Q4', v: 0.3 },
    { q: '2024 Q1', v: 0.5 }, { q: '2024 Q2', v: 0.6 }, { q: '2024 Q3', v: 0.4 }, { q: '2024 Q4', v: 0.5 },
    { q: '2025 Q1', v: 0.7 }, { q: '2025 Q2', v: 0.5 }, { q: '2025 Q3', v: 0.4 }, { q: '2025 Q4', v: 0.6 },
    { q: '2026 Q1', v: 0.4 },
  ],

  // ============ Inflation monthly LIK YoY % ============
  inflationMonthly: [
    { m: '2022-01', v: 1.6 }, { m: '2022-04', v: 2.5 }, { m: '2022-07', v: 3.4 }, { m: '2022-10', v: 3.0 },
    { m: '2023-01', v: 3.3 }, { m: '2023-04', v: 2.6 }, { m: '2023-07', v: 1.6 }, { m: '2023-10', v: 1.7 },
    { m: '2024-01', v: 1.3 }, { m: '2024-04', v: 1.4 }, { m: '2024-07', v: 1.3 }, { m: '2024-10', v: 0.6 },
    { m: '2025-01', v: 0.4 }, { m: '2025-04', v: 0.0 }, { m: '2025-07', v: 0.1 }, { m: '2025-10', v: 0.2 },
    { m: '2026-01', v: 0.4 }, { m: '2026-04', v: 0.3 },
  ],

  // Beitrag zur Inflation (Apr 2026, in Prozentpunkten)
  inflationDrivers: [
    { cat: 'Wohnen & Energie', value: 0.62, weight: 25.2 },
    { cat: 'Nahrungsmittel', value: 0.08, weight: 10.9 },
    { cat: 'Gastgewerbe', value: 0.15, weight: 8.2 },
    { cat: 'Gesundheit', value: 0.05, weight: 16.5 },
    { cat: 'Verkehr', value: -0.32, weight: 11.0 },
    { cat: 'Freizeit & Kultur', value: -0.05, weight: 9.1 },
    { cat: 'Bekleidung', value: -0.04, weight: 3.5 },
    { cat: 'Übrige', value: 0.01, weight: 15.6 },
  ],

  // ============ Arbeitslosigkeit by Kanton (SECO Apr 2026, %) ============
  arbeitslosKanton: [
    { code: 'GE', name: 'Genève', value: 4.4 }, { code: 'VD', name: 'Vaud', value: 3.7 },
    { code: 'NE', name: 'Neuchâtel', value: 3.8 }, { code: 'JU', name: 'Jura', value: 3.5 },
    { code: 'TI', name: 'Ticino', value: 2.7 }, { code: 'BS', name: 'Basel-Stadt', value: 3.3 },
    { code: 'ZH', name: 'Zürich', value: 3.0 }, { code: 'BE', name: 'Bern', value: 2.1 },
    { code: 'AG', name: 'Aargau', value: 2.9 }, { code: 'SO', name: 'Solothurn', value: 2.8 },
    { code: 'LU', name: 'Luzern', value: 2.0 }, { code: 'SG', name: 'St. Gallen', value: 2.3 },
    { code: 'FR', name: 'Fribourg', value: 2.6 }, { code: 'VS', name: 'Valais', value: 2.9 },
    { code: 'BL', name: 'Basel-Landschaft', value: 2.7 }, { code: 'TG', name: 'Thurgau', value: 2.4 },
    { code: 'GR', name: 'Graubünden', value: 1.4 }, { code: 'ZG', name: 'Zug', value: 1.9 },
    { code: 'SH', name: 'Schaffhausen', value: 2.4 }, { code: 'SZ', name: 'Schwyz', value: 1.5 },
    { code: 'OW', name: 'Obwalden', value: 1.1 }, { code: 'NW', name: 'Nidwalden', value: 1.2 },
    { code: 'GL', name: 'Glarus', value: 1.7 }, { code: 'AR', name: 'Appenzell A.Rh.', value: 1.4 },
    { code: 'AI', name: 'Appenzell I.Rh.', value: 0.7 }, { code: 'UR', name: 'Uri', value: 0.8 },
  ],

  // Arbeitslosenquote Zeitreihe
  arbeitslosTimeline: [
    { y: '2015', v: 3.3 }, { y: '2016', v: 3.3 }, { y: '2017', v: 3.2 }, { y: '2018', v: 2.6 },
    { y: '2019', v: 2.3 }, { y: '2020', v: 3.1 }, { y: '2021', v: 3.0 }, { y: '2022', v: 2.2 },
    { y: '2023', v: 2.0 }, { y: '2024', v: 2.4 }, { y: '2025', v: 2.8 }, { y: '2026', v: 2.7 },
  ],

  // Branchen Beschäftigung
  branchen: [
    { name: 'Gesundheit & Soziales', share: 14.2, growth: 2.1 },
    { name: 'Handel', share: 12.4, growth: 0.3 },
    { name: 'Industrie', share: 11.8, growth: -0.8 },
    { name: 'Baugewerbe', share: 7.6, growth: 0.5 },
    { name: 'Finanz & Versicherung', share: 5.2, growth: 1.2 },
    { name: 'IT & Information', share: 4.8, growth: 4.7 },
    { name: 'Gastgewerbe', share: 4.4, growth: 1.8 },
    { name: 'Bildung', share: 6.9, growth: 1.1 },
    { name: 'Öff. Verwaltung', share: 4.2, growth: 0.9 },
    { name: 'Übrige', share: 28.5, growth: 0.6 },
  ],

  // Median-Lohn nach Branche (CHF/Monat brutto)
  loehne: [
    { branche: 'Pharma', value: 9847 },
    { branche: 'Banken', value: 9421 },
    { branche: 'IT', value: 8920 },
    { branche: 'Versicherung', value: 8650 },
    { branche: 'Industrie', value: 7110 },
    { branche: 'Baugewerbe', value: 6620 },
    { branche: 'Handel', value: 5840 },
    { branche: 'Gesundheit', value: 6740 },
    { branche: 'Gastgewerbe', value: 4520 },
    { branche: 'Detailhandel', value: 5180 },
  ],

  // ============ Bevölkerung ============
  bevoelkerungTimeline: [
    { y: 2000, v: 7.20 }, { y: 2005, v: 7.46 }, { y: 2010, v: 7.87 },
    { y: 2015, v: 8.33 }, { y: 2020, v: 8.67 }, { y: 2021, v: 8.74 },
    { y: 2022, v: 8.81 }, { y: 2023, v: 8.92 }, { y: 2024, v: 9.00 },
  ],

  // Bevölkerungspyramide (in Tausend)
  pyramide: [
    { age: '0-9',   m: 426, w: 405 }, { age: '10-19', m: 461, w: 437 },
    { age: '20-29', m: 540, w: 524 }, { age: '30-39', m: 671, w: 657 },
    { age: '40-49', m: 599, w: 583 }, { age: '50-59', m: 660, w: 643 },
    { age: '60-69', m: 542, w: 552 }, { age: '70-79', m: 388, w: 421 },
    { age: '80+',   m: 188, w: 304 },
  ],

  // Migration Saldo (Tsd)
  migration: [
    { y: 2018, zu: 144, weg: 92, saldo: 52 },
    { y: 2019, zu: 142, weg: 96, saldo: 46 },
    { y: 2020, zu: 137, weg: 95, saldo: 42 },
    { y: 2021, zu: 154, weg: 88, saldo: 66 },
    { y: 2022, zu: 190, weg: 109, saldo: 81 },
    { y: 2023, zu: 184, weg: 102, saldo: 82 },
    { y: 2024, zu: 173, weg: 106, saldo: 67 },
  ],

  // Aussenhandel (Mrd CHF)
  aussenhandel: [
    { y: 2018, ex: 233.0, im: 203.3 },
    { y: 2019, ex: 242.5, im: 207.7 },
    { y: 2020, ex: 225.1, im: 184.9 },
    { y: 2021, ex: 259.6, im: 211.5 },
    { y: 2022, ex: 278.6, im: 233.4 },
    { y: 2023, ex: 283.5, im: 240.1 },
    { y: 2024, ex: 296.2, im: 249.1 },
  ],

  // SNB Leitzins
  snbleitzins: [
    { d: '2022-06', v: -0.75 }, { d: '2022-09', v: -0.25 }, { d: '2022-12', v: 1.00 },
    { d: '2023-03', v: 1.50 }, { d: '2023-06', v: 1.75 }, { d: '2023-09', v: 1.75 },
    { d: '2024-03', v: 1.50 }, { d: '2024-06', v: 1.25 }, { d: '2024-09', v: 1.00 },
    { d: '2024-12', v: 0.50 }, { d: '2025-03', v: 0.25 }, { d: '2025-06', v: 0.00 },
    { d: '2025-09', v: 0.00 }, { d: '2025-12', v: 0.00 }, { d: '2026-03', v: 0.00 },
  ],

  // Hypothekarzinsen
  hypozinsen: [
    { y: '2020', fest5: 1.05, fest10: 1.25, saron: 0.75 },
    { y: '2021', fest5: 1.10, fest10: 1.30, saron: 0.75 },
    { y: '2022', fest5: 2.65, fest10: 2.85, saron: 1.20 },
    { y: '2023', fest5: 2.20, fest10: 2.35, saron: 2.30 },
    { y: '2024', fest5: 1.55, fest10: 1.75, saron: 1.45 },
    { y: '2025', fest5: 1.30, fest10: 1.50, saron: 0.70 },
    { y: '2026', fest5: 1.10, fest10: 1.30, saron: 0.55 },
  ],

  // Konkurse + Neugründungen
  konkurse: [
    { y: 2019, kon: 4838, neu: 46612 },
    { y: 2020, kon: 4541, neu: 46842 },
    { y: 2021, kon: 4744, neu: 51422 },
    { y: 2022, kon: 5417, neu: 49902 },
    { y: 2023, kon: 6730, neu: 50601 },
    { y: 2024, kon: 7960, neu: 49521 },
    { y: 2025, kon: 8210, neu: 48840 },
  ],

  // LIK Index zur Kaufkraft-Berechnung (Dez 2020 = 100)
  likIndex: {
    2000: 87.6, 2005: 91.7, 2010: 96.6, 2015: 98.2, 2018: 98.7,
    2020: 99.6, 2021: 100.2, 2022: 103.1, 2023: 105.3, 2024: 106.4, 2025: 107.5, 2026: 107.8,
  },
};
