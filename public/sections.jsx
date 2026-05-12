// BFS Dashboard — Sections
const { useState: useStateS, useMemo: useMemoS, useEffect: useEffectS } = React;

// ========== Helpers ==========
const fmtCHF = v => v.toLocaleString('de-CH');
const fmtPct = (v, d = 1) => `${v >= 0 ? '' : ''}${v.toFixed(d)}%`;
const fmtSign = (v, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

function KpiCard({ label, value, unit, delta, deltaUnit, year, spark, sparkColor, onClick, active }) {
  const up = delta >= 0;
  const positiveIsBad = label && (label.toLowerCase().includes('arbeitslos') || label.toLowerCase().includes('inflation'));
  const cls = (up !== positiveIsBad) ? 'up' : 'down';
  return (
    <div className="kpi" onClick={onClick} style={active ? { borderColor: 'var(--ink)', boxShadow: '0 0 0 2px var(--ink) inset, var(--shadow-card)' } : {}}>
      <div className="kpi-label">
        <span>{label}</span>
        <span style={{ color: 'var(--ink-4)' }}>· {year}</span>
      </div>
      <div className="kpi-value">
        {typeof value === 'number' ? value.toLocaleString('de-CH', { maximumFractionDigits: 2 }) : value}
        <span className="kpi-unit">{unit}</span>
      </div>
      <div className={`kpi-delta ${cls}`}>
        <span>{up ? '▲' : '▼'}</span>
        <span>{fmtSign(delta, Math.abs(delta) < 1 ? 2 : 1)} {deltaUnit}</span>
      </div>
      {spark && (
        <div className="kpi-spark">
          <Sparkline data={spark} w={70} h={22} color={sparkColor || (cls === 'up' ? 'var(--up)' : 'var(--down)')} fill />
        </div>
      )}
    </div>
  );
}

// ========== ÜBERSICHT ==========
function OverviewSection({ onGoTo, dataStatus }) {
  const D = window.BFS_DATA;
  const [comparison, setComparison] = useStateS(['bip', 'inflation']);
  const [timeRange, setTimeRange]   = useStateS('5J');

  const RANGES = { '1J': { q: 4, m: 12 }, '5J': { q: 20, m: 60 }, '10J': { q: 40, m: 120 }, 'Max': { q: 999, m: 999 } };
  const r = RANGES[timeRange];

  const bipData  = D.bipQuarterly.slice(-r.q);
  const inflData = D.inflationMonthly.slice(-r.m);
  const alData   = D.arbeitslosTimeline.slice(-r.m);
  const snbData  = D.snbleitzins.slice(-r.m);

  const sparks = {
    bip:         bipData.map(d => d.v),
    inflation:   inflData.map(d => d.v),
    arbeitslos:  alData.map(d => d.v),
    bevoelkerung: D.bevoelkerungTimeline.map(d => d.v),
    leerwohnung: [1.62, 1.54, 1.49, 1.31, 1.15, 1.08],
    medianlohn:  [6488, 6502, 6538, 6620, 6665, 6788],
    snbleitzins: snbData.map(d => d.v),
    handelsbilanz: D.aussenhandel.map(d => d.ex - d.im),
  };

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-title">Übersicht Schweiz</div>
          <div className="section-desc">Headline-Indikatoren in Echtzeit. Quellen: BFS, SECO, SNB. Aktualisiert monatlich.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dataStatus === 'live'
            ? <span className="tag live">live · BFS feed</span>
            : dataStatus === 'loading'
            ? <span className="tag">laden…</span>
            : <span className="tag">statisch</span>
          }
          <div className="btn-group">
            {['1J', '5J', '10J', 'Max'].map(label => (
              <button key={label}
                className={`btn ${timeRange === label ? 'active' : ''}`}
                onClick={() => setTimeRange(label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-4">
        <KpiCard {...D.kpis.bip} spark={sparks.bip} onClick={() => onGoTo('wirtschaft')} />
        <KpiCard {...D.kpis.inflation} spark={sparks.inflation} onClick={() => onGoTo('preise')} />
        <KpiCard {...D.kpis.arbeitslos} spark={sparks.arbeitslos} onClick={() => onGoTo('arbeit')} />
        <KpiCard {...D.kpis.bevoelkerung} spark={sparks.bevoelkerung} onClick={() => onGoTo('bevoelkerung')} />
      </div>

      <div style={{ height: 12 }} />

      <div className="grid grid-4">
        <KpiCard {...D.kpis.snbleitzins} spark={sparks.snbleitzins} onClick={() => onGoTo('wirtschaft')} />
        <KpiCard {...D.kpis.medianlohn} spark={sparks.medianlohn} onClick={() => onGoTo('arbeit')} />
        <KpiCard {...D.kpis.leerwohnung} spark={sparks.leerwohnung} onClick={() => onGoTo('bevoelkerung')} />
        <KpiCard {...D.kpis.handelsbilanz} spark={sparks.handelsbilanz} onClick={() => onGoTo('wirtschaft')} />
      </div>

      <div style={{ height: 24 }} />

      {/* COMPARE MODE — uses filtered bipData */}
      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="card-title">Vergleichsmodus · Zwei Indikatoren überlagern</div>
            <div className="card-sub">Multi-Achsen-Visualisierung. Wähle bis zu 2 Kennzahlen.</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['bip', 'inflation', 'arbeitslos', 'snbleitzins'].map(k => (
              <button key={k}
                className={`btn ${comparison.includes(k) ? 'active' : ''}`}
                onClick={() => {
                  setComparison(c =>
                    c.includes(k) ? c.filter(x => x !== k) : (c.length >= 2 ? [c[1], k] : [...c, k])
                  );
                }}>
                {D.kpis[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <CompareChart keys={comparison} />
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Wirtschaft im Wandel · BIP real (QoQ, %)</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>{timeRange === 'Max' ? 'Alle Daten' : timeRange}</div>
          </div>
          <div className="card-body">
            <AreaChart data={bipData} xKey="q" yKey="v" h={220}
              color="var(--accent)" formatY={v => `${v.toFixed(1)}%`} baseline={0} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top Wirtschaftsereignisse</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Q2 2025</div>
          </div>
          <div style={{ padding: '4px 0' }}>
            {[
              { d: '20. Mär', t: 'SNB senkt Leitzins auf 0.25%', cat: 'Geldpolitik' },
              { d: '15. Mär', t: 'Inflation Februar bei 0.3% — unter SNB-Zielkorridor', cat: 'Preise' },
              { d: '01. Mär', t: 'Arbeitslosenquote steigt auf 2.9%', cat: 'Arbeit' },
              { d: '28. Feb', t: 'Aussenhandel verzeichnet Rekord-Exportplus', cat: 'Handel' },
              { d: '15. Feb', t: 'Wohnbevölkerung überschreitet 9-Mio-Marke', cat: 'Bevölkerung' },
            ].map((e, i) => (
              <div key={i} style={{ padding: '11px 16px', borderTop: i ? '1px solid var(--line)' : 'none', display: 'flex', gap: 12 }}>
                <div className="mono" style={{ color: 'var(--ink-3)', fontSize: 11, minWidth: 50 }}>{e.d}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{e.t}</div>
                  <div className="tag" style={{ marginTop: 4 }}>{e.cat}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompareChart({ keys }) {
  const D = window.BFS_DATA;
  const yearLabels = ['2020', '2021', '2022', '2023', '2024', '2025'];
  const colors = ['var(--accent)', 'var(--info)'];
  const seriesDataFor = k => {
    const map = {
      bip: [-1.9, 5.4, 2.5, 1.2, 1.5, 1.7],
      inflation: [-0.7, 0.6, 2.8, 2.1, 1.1, 0.4],
      arbeitslos: [3.1, 3.0, 2.2, 2.0, 2.4, 2.8],
      snbleitzins: [-0.75, -0.75, 1.00, 1.75, 0.50, 0.25],
    };
    return yearLabels.map((y, i) => ({ y, v: map[k][i] }));
  };
  const norm = yearLabels.map((y, i) => {
    const o = { y };
    keys.forEach(k => {
      const arr = seriesDataFor(k).map(d => d.v);
      const min = Math.min(...arr), max = Math.max(...arr);
      o[k] = ((seriesDataFor(k)[i].v - min) / (max - min || 1)) * 100;
    });
    return o;
  });
  const series = keys.map((k, i) => ({
    data: norm, key: k, color: colors[i], label: D.kpis[k].label,
  }));

  return (
    <div>
      <AreaChart h={260} xKey="y" yKey={keys[0]} multi={series} data={norm}
                 formatY={v => `${v.toFixed(0)}`} yMin={0} yMax={100} />
      <div style={{ display: 'flex', gap: 18, marginTop: 8, justifyContent: 'center', fontSize: 11.5 }}>
        {keys.map((k, i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-2)' }}>
            <span style={{ width: 10, height: 2, background: colors[i], display: 'inline-block' }} />
            <span>{D.kpis[k].label}</span>
            <span className="mono" style={{ color: 'var(--ink-3)' }}>aktuell {D.kpis[k].value}{D.kpis[k].unit}</span>
          </div>
        ))}
      </div>
      <div className="footer-note">⚠ Werte normalisiert (0–100). Achsen-Skala an absolute Werte angepasst.</div>
    </div>
  );
}

// ========== WIRTSCHAFT & BANKING ==========
function WirtschaftSection() {
  const D = window.BFS_DATA;
  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-title">Wirtschaft & Banking</div>
          <div className="section-desc">BIP-Entwicklung, Geldpolitik der SNB, Zinslandschaft und Aussenhandel.</div>
        </div>
        <span className="tag">Stand · Apr 2025</span>
      </div>

      <div className="grid grid-3">
        <KpiCard {...D.kpis.bip} />
        <KpiCard {...D.kpis.snbleitzins} />
        <KpiCard {...D.kpis.handelsbilanz} />
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="card-header">
          <div className="card-title">BIP-Wachstum real (QoQ, in %)</div>
          <div className="card-sub" style={{ marginLeft: 'auto' }}>SECO Quartalsschätzung</div>
        </div>
        <div className="card-body">
          <AreaChart data={D.bipQuarterly} xKey="q" yKey="v" h={240}
            color="var(--accent)" formatY={v => `${v.toFixed(1)}%`} baseline={0} />
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">SNB-Leitzinspfad</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Seit Wende 2022</div>
          </div>
          <div className="card-body">
            <AreaChart data={D.snbleitzins} xKey="d" yKey="v" h={220}
              color="var(--info)" formatY={v => `${v.toFixed(2)}%`} yMin={-1} />
            <div className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>Negativzinsen-Ära: 2015 – Jun 2022</span>
              <span className="mono">Aktuell: <b style={{ color: 'var(--ink)' }}>0.25 %</b></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Hypothekarzinsen</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>3 Produkte im Vergleich</div>
          </div>
          <div className="card-body">
            <AreaChart h={220} xKey="y" yKey="fest5" multi={[
              { data: D.hypozinsen, key: 'saron', color: 'var(--accent)', label: 'SARON' },
              { data: D.hypozinsen, key: 'fest5', color: 'var(--info)', label: '5J Fest' },
              { data: D.hypozinsen, key: 'fest10', color: 'var(--warn)', label: '10J Fest' },
            ]} data={D.hypozinsen} formatY={v => `${v.toFixed(2)}%`} />
            <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, justifyContent: 'center' }}>
              {[['SARON', 'var(--accent)'], ['5J Fest', 'var(--info)'], ['10J Fest', 'var(--warn)']].map(([l, c]) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-2)' }}>
                  <span style={{ width: 10, height: 2, background: c }} />{l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Aussenhandel · Exporte vs. Importe</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Mrd CHF</div>
          </div>
          <div className="card-body">
            <StackedBars data={D.aussenhandel.map(d => ({ y: d.y, Export: d.ex, Import: d.im }))}
              keys={['Export', 'Import']} colors={['var(--accent)', 'var(--info)']} h={220} xKey="y"
              formatY={v => v.toFixed(0)} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span><span style={{ background: 'var(--accent)', display: 'inline-block', width: 9, height: 9, marginRight: 5 }} />Exporte</span>
              <span><span style={{ background: 'var(--info)', display: 'inline-block', width: 9, height: 9, marginRight: 5 }} />Importe</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Unternehmensdynamik</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Konkurse vs. Neugründungen</div>
          </div>
          <div className="card-body">
            <table className="data">
              <thead>
                <tr><th>Jahr</th><th className="num">Konkurse</th><th className="num">Neugründungen</th><th className="num">Saldo</th></tr>
              </thead>
              <tbody>
                {D.konkurse.map(k => (
                  <tr key={k.y}>
                    <td className="mono">{k.y}</td>
                    <td className="num">{fmtCHF(k.kon)}</td>
                    <td className="num">{fmtCHF(k.neu)}</td>
                    <td className="num" style={{ color: 'var(--up)' }}>+{fmtCHF(k.neu - k.kon)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="footer-note">↗ Konkurse +18% YoY · Rekordhoch seit 1995.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== ARBEIT ==========
function ArbeitSection() {
  const D = window.BFS_DATA;
  const [hovered, setHovered] = useStateS(null);

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-title">Arbeit & Beschäftigung</div>
          <div className="section-desc">Arbeitslosenquote nach Kanton, Branchen, Löhne. SECO & BFS-SAKE.</div>
        </div>
        <span className="tag">Stand · Apr 2025</span>
      </div>

      <div className="grid grid-3">
        <KpiCard {...D.kpis.arbeitslos} />
        <KpiCard {...D.kpis.medianlohn} />
        <KpiCard label="Offene Stellen" value={51.2} unit="Tsd" delta={-3.4} deltaUnit="% YoY" year="Q1 2025" />
      </div>

      <div style={{ height: 16 }} />

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Arbeitslosenquote nach Kanton</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Interaktive Karte · April 2025</div>
          </div>
          <div className="card-body">
            <SwissMap data={D.arbeitslosKanton} onHover={setHovered} valueLabel="%" />
            <div className="footer-note">Daten: SECO · Geometrie: swissBOUNDARIES3D (BFS) · CH1903+ Projektion</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Quote im 10-Jahres-Vergleich</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>SECO</div>
          </div>
          <div className="card-body">
            <AreaChart data={D.arbeitslosTimeline} xKey="y" yKey="v" h={220}
              color="var(--accent)" formatY={v => `${v.toFixed(1)}%`} />
            <div className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>Tiefstand 2023: <b className="mono" style={{ color: 'var(--ink)' }}>2.0%</b></span>
              <span>Pandemie-Peak: <b className="mono" style={{ color: 'var(--ink)' }}>3.4%</b> (Aug 2020)</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Beschäftigung nach Branche</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Anteil & Wachstum YoY</div>
          </div>
          <div className="card-body">
            <BarChartH data={D.branchen} labelKey="name" valueKey="share"
              formatV={v => `${v.toFixed(1)}%`}
              color={(d, i) => `oklch(${56 - i * 2}% 0.10 ${25 + i * 6})`} />
            <div className="hr" />
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {D.branchen.slice(0, 6).map(b => (
                <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{b.name}</span>
                  <span className="mono" style={{ color: b.growth >= 0 ? 'var(--up)' : 'var(--down)' }}>
                    {b.growth >= 0 ? '+' : ''}{b.growth.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Medianlohn nach Branche</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>CHF brutto / Monat</div>
          </div>
          <div className="card-body">
            <BarChartH data={D.medianlohnBranche || D.loehne} labelKey="branche" valueKey="value"
              formatV={v => fmtCHF(v)}
              color="var(--info)" />
            <div className="footer-note">Quelle: BFS Lohnstrukturerhebung (LSE) · Vollzeitäquivalent.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== PREISE & KAUFKRAFT ==========
function PreiseSection() {
  const D = window.BFS_DATA;
  const [amount, setAmount] = useStateS(5000);
  const [fromYear, setFromYear] = useStateS(2010);
  const toYear = 2025;
  const indexFrom = D.likIndex[fromYear];
  const indexTo = D.likIndex[toYear];
  const purchasingPower = amount * (indexFrom / indexTo);
  const loss = ((1 - indexFrom / indexTo) * 100);

  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-title">Preise & Kaufkraft</div>
          <div className="section-desc">Inflation, Warenkorb-Treiber und der Kaufkraft-Kalkulator: was sind 1000 CHF von früher heute wert?</div>
        </div>
        <span className="tag">LIK · Dez 2020 = 100</span>
      </div>

      <div className="grid grid-3">
        <KpiCard {...D.kpis.inflation} />
        <KpiCard label="Kerninflation" value={0.7} unit="%" delta={-0.3} deltaUnit="pp YoY" year="Apr 2025" />
        <KpiCard label="LIK-Index" value={106.8} unit="Pkt" delta={0.4} deltaUnit="% YoY" year="Apr 2025" />
      </div>

      <div style={{ height: 16 }} />

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Inflationsverlauf (LIK, YoY %)</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>SNB-Zielkorridor: 0–2%</div>
          </div>
          <div className="card-body">
            <AreaChart data={D.inflationMonthly} xKey="m" yKey="v" h={240}
              color="var(--accent)" formatY={v => `${v.toFixed(1)}%`} baseline={0} />
            <div className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>Peak: <b className="mono" style={{ color: 'var(--ink)' }}>3.5%</b> (Aug 2022)</span>
              <span>Aktuell: <b className="mono" style={{ color: 'var(--ink)' }}>0.4%</b> · klar unter SNB-Ziel</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Was treibt die Inflation?</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Beitrag in Prozentpunkten</div>
          </div>
          <div className="card-body">
            <DivergingBars data={D.inflationDrivers} h={240} />
            <div className="footer-note">Wohnen & Energie tragen +0.62pp bei · Verkehr −0.32pp dämpft.</div>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* KAUFKRAFT-KALKULATOR */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">⚡ Kaufkraft-Kalkulator</div>
          <div className="card-sub" style={{ marginLeft: 'auto' }}>Was sind CHF von früher heute wert?</div>
        </div>
        <div className="card-body">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr', gap: 32, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Betrag eingeben</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
                <input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px',
                           color: 'var(--ink)', fontSize: 22, fontFamily: 'IBM Plex Mono', width: 160, outline: 'none' }} />
                <span style={{ color: 'var(--ink-3)', fontSize: 14 }}>CHF aus</span>
                <select value={fromYear} onChange={e => setFromYear(parseInt(e.target.value))}
                  style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px',
                           color: 'var(--ink)', fontSize: 22, fontFamily: 'IBM Plex Mono', outline: 'none' }}>
                  {Object.keys(D.likIndex).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--ink-3)' }}>
                <span>Index {fromYear}: <span className="mono" style={{ color: 'var(--ink)' }}>{indexFrom.toFixed(1)}</span></span>
                <span>Index 2025: <span className="mono" style={{ color: 'var(--ink)' }}>{indexTo.toFixed(1)}</span></span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-elev)', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Heutige Kaufkraft</div>
              <div style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', margin: '4px 0' }}>
                {purchasingPower.toLocaleString('de-CH', { maximumFractionDigits: 0 })} <span style={{ fontSize: 16, color: 'var(--ink-3)' }}>CHF</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                CHF <b className="mono">{fmtCHF(amount)}</b> aus <b>{fromYear}</b> entsprechen real <b className="mono">{purchasingPower.toLocaleString('de-CH', { maximumFractionDigits: 0 })}</b> CHF heute.
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--down-soft)', borderRadius: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--down)' }}>▼ Kaufkraftverlust:</span>
                <span className="mono" style={{ color: 'var(--down)', marginLeft: 6, fontWeight: 600 }}>{loss.toFixed(1)}%</span>
                <span style={{ color: 'var(--ink-2)', marginLeft: 6 }}>seit {fromYear}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== BEVÖLKERUNG ==========
function BevoelkerungSection() {
  const D = window.BFS_DATA;
  return (
    <div>
      <div className="section-head">
        <div>
          <div className="section-title">Bevölkerung & Gesellschaft</div>
          <div className="section-desc">Wohnbevölkerung, Altersstruktur und Migrationssaldo. Daten: STATPOP, BEVNAT.</div>
        </div>
        <span className="tag">2024 · 9.00 Mio</span>
      </div>

      <div className="grid grid-3">
        <KpiCard {...D.kpis.bevoelkerung} />
        <KpiCard label="Migrationssaldo" value={67.2} unit="Tsd" delta={-18.0} deltaUnit="% YoY" year="2024" />
        <KpiCard {...D.kpis.leerwohnung} />
      </div>

      <div style={{ height: 16 }} />

      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Wohnbevölkerung (Mio)</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>2000 – 2024</div>
          </div>
          <div className="card-body">
            <AreaChart data={D.bevoelkerungTimeline} xKey="y" yKey="v" h={240}
              color="var(--info)" formatY={v => `${v.toFixed(2)}M`} yMin={7} />
            <div className="hr" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>+1.80 Mio seit 2000 · <span style={{ color: 'var(--ink)' }}>+25%</span></span>
              <span>Prognose 2030: <b className="mono" style={{ color: 'var(--ink)' }}>9.5 M</b></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Alterspyramide</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>in Tsd, 2024</div>
          </div>
          <div className="card-body">
            <Pyramide data={D.pyramide} h={300} />
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Migration · Zu- und Wegzüge (Tsd)</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Internationaler Saldo</div>
          </div>
          <div className="card-body">
            <AreaChart h={220} xKey="y" yKey="zu" multi={[
              { data: D.migration, key: 'zu', color: 'var(--accent)', label: 'Zuwanderung' },
              { data: D.migration, key: 'weg', color: 'var(--info)', label: 'Auswanderung' },
            ]} data={D.migration} formatY={v => `${v.toFixed(0)}k`} />
            <div className="hr" />
            <table className="data">
              <thead><tr><th>Jahr</th><th className="num">Zu</th><th className="num">Weg</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {D.migration.slice(-4).map(m => (
                  <tr key={m.y}>
                    <td className="mono">{m.y}</td>
                    <td className="num">{m.zu}</td>
                    <td className="num">{m.weg}</td>
                    <td className="num" style={{ color: 'var(--up)' }}>+{m.saldo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Wohnungsmarkt</div>
            <div className="card-sub" style={{ marginLeft: 'auto' }}>Leerwohnungsziffer in %</div>
          </div>
          <div className="card-body">
            <AreaChart data={[
              { y: '2018', v: 1.62 }, { y: '2019', v: 1.66 }, { y: '2020', v: 1.72 },
              { y: '2021', v: 1.54 }, { y: '2022', v: 1.31 }, { y: '2023', v: 1.15 }, { y: '2024', v: 1.08 },
            ]} xKey="y" yKey="v" h={220} color="var(--down)" formatY={v => `${v.toFixed(2)}%`} />
            <div className="hr" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>Tiefster Wert seit</div>
                <div style={{ fontSize: 18, fontWeight: 500 }} className="mono">2014</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>Ø Bestand Schweiz</div>
                <div style={{ fontSize: 18, fontWeight: 500 }} className="mono">4.74 Mio Wohn.</div>
              </div>
            </div>
            <div className="footer-note">⚠ Wohnungsknappheit verschärft sich · 7. Rückgang in Folge.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  KpiCard, OverviewSection, WirtschaftSection, ArbeitSection, PreiseSection, BevoelkerungSection, CompareChart,
});
