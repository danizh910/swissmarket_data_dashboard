// BFS Statistik Hub — Main App
const { useState: useStateA, useEffect: useEffectA } = React;

const NAV = [
  { id: 'overview',    label: 'Übersicht',          kbd: 'O' },
  { id: 'wirtschaft', label: 'Wirtschaft & Banking', kbd: 'W' },
  { id: 'arbeit',     label: 'Arbeit',               kbd: 'A' },
  { id: 'preise',     label: 'Preise & Kaufkraft',   kbd: 'P' },
  { id: 'bevoelkerung', label: 'Bevölkerung',        kbd: 'B' },
];

// Merge live API data into window.BFS_DATA
function applyLiveData(apiData) {
  const D = window.BFS_DATA;

  if (apiData.population?.length) {
    D.bevoelkerungTimeline = apiData.population;
    const latest = apiData.population.at(-1);
    const prev   = apiData.population.at(-2);
    if (latest && prev) {
      D.kpis.bevoelkerung = {
        ...D.kpis.bevoelkerung,
        value: +latest.v.toFixed(3),
        delta: +((latest.v - prev.v) / prev.v * 100).toFixed(2),
        year:  String(latest.y),
      };
    }
  }

  if (apiData.unemploymentTimeline?.length) {
    D.arbeitslosTimeline = apiData.unemploymentTimeline;
    const latest = apiData.unemploymentTimeline.at(-1);
    const prev   = apiData.unemploymentTimeline.at(-2);
    if (latest && prev) {
      D.kpis.arbeitslos = {
        ...D.kpis.arbeitslos,
        value: latest.v,
        delta: +(latest.v - prev.v).toFixed(2),
        year:  latest.y?.slice(0, 7) ?? latest.y,
      };
    }
  }

  if (apiData.unemploymentKanton?.length) {
    D.arbeitslosKanton = apiData.unemploymentKanton;
  }

  if (apiData.inflation?.length) {
    D.inflationMonthly = apiData.inflation;
    const latest = apiData.inflation.at(-1);
    const prev   = apiData.inflation.at(-2);
    if (latest && prev) {
      D.kpis.inflation = {
        ...D.kpis.inflation,
        value: latest.v,
        delta: +(latest.v - prev.v).toFixed(2),
        year:  latest.m,
      };
    }
  }

  if (apiData.snbLeitzins?.length) {
    D.snbleitzins = apiData.snbLeitzins;
    const latest = apiData.snbLeitzins.at(-1);
    const prev   = apiData.snbLeitzins.find(d => d.d < latest.d && d.v !== latest.v);
    if (latest) {
      D.kpis.snbleitzins = {
        ...D.kpis.snbleitzins,
        value: latest.v,
        delta: prev ? +(latest.v - prev.v).toFixed(2) : 0,
        year:  latest.d,
      };
    }
  }

  if (apiData.aussenhandel?.length) {
    D.aussenhandel = apiData.aussenhandel;
    const latest = apiData.aussenhandel.at(-1);
    const prev   = apiData.aussenhandel.at(-2);
    if (latest && prev) {
      const saldo     = latest.ex - latest.im;
      const saldoPrev = prev.ex - prev.im;
      D.kpis.handelsbilanz = {
        ...D.kpis.handelsbilanz,
        value: +saldo.toFixed(1),
        delta: +((saldo - saldoPrev) / Math.abs(saldoPrev) * 100).toFixed(1),
        year:  String(latest.y),
      };
    }
  }

  if (apiData.wages?.length) {
    D.medianlohnBranche = apiData.wages;
    const total = apiData.wages.find(w => w.code === 'tot');
    if (total) {
      D.kpis.medianlohn = { ...D.kpis.medianlohn, value: total.value };
    }
  }
}

function App() {
  const [route, setRoute]   = useStateA('overview');
  const [theme, setTheme]   = useStateA(() => localStorage.getItem('bfs-theme') || 'light');
  const [search, setSearch] = useStateA('');
  const [dataStatus, setDataStatus] = useStateA('loading'); // 'loading' | 'live' | 'static'
  const [updatedAt, setUpdatedAt]   = useStateA(null);
  const [tick, setTick]     = useStateA(0); // forces re-render after data merge

  useEffectA(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bfs-theme', theme);
  }, [theme]);

  useEffectA(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data) {
          applyLiveData(json.data);
          setUpdatedAt(json.updatedAt);
          setDataStatus('live');
          setTick(t => t + 1);
        } else {
          setDataStatus('static');
        }
      })
      .catch(() => setDataStatus('static'));
  }, []);

  useEffectA(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const hit = NAV.find(n => n.kbd.toLowerCase() === k);
      if (hit) setRoute(hit.id);
      if (k === 't') setTheme(t => t === 'dark' ? 'light' : 'dark');
      if (e.key === '/' && !e.metaKey) { e.preventDefault(); document.querySelector('.search input').focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Sections = {
    overview:     () => <OverviewSection onGoTo={setRoute} />,
    wirtschaft:   WirtschaftSection,
    arbeit:       ArbeitSection,
    preise:       PreiseSection,
    bevoelkerung: BevoelkerungSection,
  };
  const Current    = Sections[route];
  const currentNav = NAV.find(n => n.id === route);

  const statusLabel = dataStatus === 'loading' ? '…' : dataStatus === 'live' ? 'live' : 'static';
  const statusClass = dataStatus === 'live' ? 'live' : '';
  const lastSync = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) + ' UTC'
    : '—';

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <div className="brand-name">Statistik Hub</div>
            <div className="brand-sub">BFS · SECO · SNB</div>
          </div>
        </div>

        <div className="nav-section">Dashboard</div>
        {NAV.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => setRoute(n.id)}>
            <span className="nav-dot" />
            <span>{n.label}</span>
            <span className="nav-shortcut">{n.kbd}</span>
          </div>
        ))}

        <div className="nav-section">Werkzeuge</div>
        <div className="nav-item" onClick={() => setRoute('preise')}>
          <span className="nav-dot" />
          <span>Kaufkraft-Rechner</span>
        </div>
        <div className="nav-item">
          <span className="nav-dot" />
          <span>Export CSV</span>
        </div>
        <div className="nav-item">
          <span className="nav-dot" />
          <span>API-Zugriff</span>
        </div>

        <div className="nav-section">Status</div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span className={`tag ${statusClass}`}>{statusLabel}</span>
            <span className="mono">99.97%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono' }}>
            {dataStatus === 'live'
              ? <>Last sync · {lastSync}<br />Nächste Aktualisierung · 06:00 UTC</>
              : dataStatus === 'loading'
              ? 'Lade Live-Daten …'
              : 'Statische Daten (Fallback)'
            }
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <div className="crumb">
            Statistik Hub <span style={{ margin: '0 6px', color: 'var(--ink-4)' }}>/</span> <b>{currentNav.label}</b>
          </div>
          <div className="search">
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" strokeLinecap="round" />
              </svg>
            </span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche Indikator, Branche, Kanton …" />
            <span className="search-kbd">/</span>
          </div>
          <button className="icon-btn" title="Theme wechseln (T)" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" strokeLinecap="round" /></svg>
              : <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 9.5A6 6 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" strokeLinejoin="round" /></svg>
            }
          </button>
          <button className="icon-btn" title="Notifications">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6a4 4 0 0 1 8 0v3l1.5 2.5h-11L4 9V6z" strokeLinejoin="round" /><path d="M6.5 13a1.5 1.5 0 0 0 3 0" /></svg>
          </button>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: 12 }}>DH</div>
        </div>

        <div className="content">
          <Current />
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono' }}>
            <span>Quellen: BFS · SECO · SNB · Eidg. Zollverwaltung</span>
            <span>BFS Statistik Hub v0.5 · made for Daniel @ ZKB</span>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
