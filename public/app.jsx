// BFS Statistik Hub — Main App
const { useState: useStateA, useEffect: useEffectA, useCallback: useCallbackA } = React;

const NAV = [
  { id: 'overview',    label: 'Übersicht',          kbd: 'O' },
  { id: 'wirtschaft', label: 'Wirtschaft & Banking', kbd: 'W' },
  { id: 'arbeit',     label: 'Arbeit',               kbd: 'A' },
  { id: 'preise',     label: 'Preise & Kaufkraft',   kbd: 'P' },
  { id: 'bevoelkerung', label: 'Bevölkerung',        kbd: 'B' },
  { id: 'analyse',    label: 'Analyse & Signale',    kbd: 'S' },
];

// VAPID public key (safe to expose in frontend)
const VAPID_PUBLIC_KEY = 'BHy--n-VUUAyhXVMKzDnjvcjQVNjZOR9DEEThsm1AAh9tcL5_Rc_fVjkDOqWmbT4UqdfKxKxuH0WAZTZXvkWQyY';

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const b = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...b].map(c => c.charCodeAt(0)));
}

// ──────────────────────────────────────────────
// Merge live API data into window.BFS_DATA
// ──────────────────────────────────────────────
const MONTHS_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
function fmtMonth(code) {
  if (!code || !code.includes('-')) return code;
  const [y, m] = code.split('-');
  return `${MONTHS_DE[parseInt(m, 10) - 1] ?? m} ${y}`;
}

// YoY-Delta: Wert des Punkts 12 Monate vor dem letzten (Monatscode 'YYYY-MM')
function yoyDelta(series, monthKey, valueKey) {
  const latest = series.at(-1);
  if (!latest) return null;
  const [y, m] = String(latest[monthKey]).slice(0, 7).split('-');
  const target = `${parseInt(y) - 1}-${m}`;
  const ref = series.find(d => String(d[monthKey]).slice(0, 7) === target);
  return ref ? +(latest[valueKey] - ref[valueKey]).toFixed(2) : null;
}

function applyLiveData(apiData) {
  const D = window.BFS_DATA;
  // /api/data liefert pro Indikator { data, source, period, fetchedAt }
  const get = k => Array.isArray(apiData[k]) ? apiData[k] : apiData[k]?.data;

  const population = get('population');
  if (population?.length) {
    D.bevoelkerungTimeline = population;
    const latest = population.at(-1);
    const prev   = population.at(-2);
    if (latest && prev) {
      D.kpis.bevoelkerung = {
        ...D.kpis.bevoelkerung,
        value: +latest.v.toFixed(3),
        delta: +((latest.v - prev.v) / prev.v * 100).toFixed(2),
        year:  String(latest.y),
      };
    }
  }

  const unemployment = get('unemploymentTimeline');
  if (unemployment?.length) {
    D.arbeitslosTimeline = unemployment;
    const latest = unemployment.at(-1);
    if (latest) {
      const yoy = yoyDelta(unemployment, 'y', 'v');
      const prev = unemployment.at(-2);
      D.kpis.arbeitslos = {
        ...D.kpis.arbeitslos,
        value: latest.v,
        delta: yoy ?? (prev ? +(latest.v - prev.v).toFixed(2) : 0),
        deltaUnit: yoy != null ? 'pp YoY' : 'pp MoM',
        year:  fmtMonth(latest.y?.slice(0, 7) ?? latest.y),
      };
    }
  }

  const kanton = get('unemploymentKanton');
  if (kanton?.length) D.arbeitslosKanton = kanton;

  const inflation = get('inflation');
  if (inflation?.length) {
    // Merge live points into static baseline so the chart retains full history
    const byMonth = new Map((D.inflationMonthly ?? []).map(p => [p.m, p]));
    inflation.forEach(p => byMonth.set(p.m, p));
    D.inflationMonthly = [...byMonth.values()].sort((a, b) => a.m.localeCompare(b.m));
    const latest = D.inflationMonthly.at(-1);
    const prev   = D.inflationMonthly.at(-2);
    if (latest) {
      const yoy = yoyDelta(D.inflationMonthly, 'm', 'v');
      D.kpis.inflation = {
        ...D.kpis.inflation,
        value: latest.v,
        delta: yoy ?? (prev ? +(latest.v - prev.v).toFixed(2) : 0),
        deltaUnit: yoy != null ? 'pp YoY' : 'pp MoM',
        year:  fmtMonth(latest.m),
      };
    }
  }

  const leitzins = get('snbLeitzins');
  if (leitzins?.length) {
    D.snbleitzins = leitzins;
    const latest = leitzins.at(-1);
    const prev   = leitzins.findLast(d => d.d < latest.d && d.v !== latest.v);
    if (latest) {
      D.kpis.snbleitzins = {
        ...D.kpis.snbleitzins,
        value: latest.v,
        delta: prev ? +(latest.v - prev.v).toFixed(2) : 0,
        deltaUnit: 'pp seit letzter Änderung',
        year:  fmtMonth(latest.d),
      };
    }
  }

  const handel = get('aussenhandel');
  if (handel?.length) {
    D.aussenhandel = handel;
    const latest = handel.at(-1);
    const prev   = handel.at(-2);
    if (latest && prev) {
      const saldo = latest.ex - latest.im;
      D.kpis.handelsbilanz = {
        ...D.kpis.handelsbilanz,
        value: +saldo.toFixed(1),
        delta: +((saldo - (prev.ex - prev.im)) / Math.abs(prev.ex - prev.im) * 100).toFixed(1),
        year:  String(latest.y),
      };
    }
  }

  const wages = get('wages');
  if (wages?.length) {
    D.medianlohnBranche = wages;
    D.loehne = wages;
    const total = wages.find(w => w.code === 'tot') ?? wages[0];
    if (total) {
      D.kpis.medianlohn = {
        ...D.kpis.medianlohn,
        value: total.value,
        year: total.year ? String(total.year) : D.kpis.medianlohn.year,
      };
    }
  }
}

// ──────────────────────────────────────────────
// Export CSV helper
// ──────────────────────────────────────────────
function exportCSV() {
  const D = window.BFS_DATA;
  const bom = '﻿';
  const header = 'Indikator;Wert;Einheit;Periode\n';
  const rows = Object.values(D.kpis).map(k => `${k.label};${k.value};${k.unit};${k.year}`).join('\n');
  const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), {
    href: url, download: `bfs-kpis-${new Date().toISOString().slice(0, 10)}.csv`,
  }).click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// Push Subscribe Logic
// ──────────────────────────────────────────────
async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'default';
  } catch { return 'default'; }
}

async function subscribePush(setStatus) {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { setStatus('denied'); return; }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub }),
    });
    if (!res.ok) throw new Error('Subscribe API failed');
    setStatus('subscribed');
  } catch (err) {
    console.error('[push]', err);
    setStatus('default');
  }
}

async function unsubscribePush(setStatus) {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setStatus('default');
  } catch (err) {
    console.error('[push unsubscribe]', err);
  }
}

// ──────────────────────────────────────────────
// Overlay (dismiss dropdowns on outside click)
// ──────────────────────────────────────────────
function Overlay({ onClose }) {
  return <div className="overlay-dismiss" onClick={onClose} />;
}

// ──────────────────────────────────────────────
// API-Zugriff Modal
// ──────────────────────────────────────────────
function ApiModal({ onClose }) {
  const base = window.location.origin;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">API-Zugriff</div>
        <div className="modal-sub">Direkter Zugriff auf den BFS Statistik Hub Cache via REST-API.</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>GET · Cached Indicators</div>
          <div className="code-block">{`GET ${base}/api/data

{
  "ok": true,
  "updatedAt": "...",
  "data": {
    "population": [...],
    "inflation": [...],
    "snbLeitzins": [...],
    "wages": [...]
  }
}`}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>POST · Refresh (erfordert Auth)</div>
          <div className="code-block">{`POST ${base}/api/refresh
Authorization: Bearer <CRON_SECRET>

{ "ok": true, "results": { ... } }`}</div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 14 }}>
          Cache: Neon PostgreSQL · Aktualisierung täglich 06:00 UTC
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>Schliessen</button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Notification dropdown (bell)
// ──────────────────────────────────────────────
function NotificationDropdown({ updatedAt, pushStatus, setPushStatus, onClose }) {
  const timeStr = updatedAt
    ? new Date(updatedAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })
    : null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <>
      <Overlay onClose={onClose} />
      <div className="dropdown" style={{ minWidth: 280, right: 0 }}>
        <div className="dropdown-section">
          <div className="dropdown-label">Letzte Aktualisierung</div>
          <div className="dropdown-item" style={{ cursor: 'default' }}>
            {timeStr
              ? <><span style={{ color: 'var(--up)', fontSize: 13 }}>✓</span><div><div style={{ fontSize: 12.5, color: 'var(--ink)' }}>Daten aktualisiert</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{timeStr}</div></div></>
              : <span style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>Noch keine Live-Daten</span>
            }
          </div>
        </div>

        <div className="dropdown-section">
          <div className="dropdown-label">Push-Benachrichtigungen</div>
          {pushStatus === 'unsupported' && (
            <div className="dropdown-item" style={{ cursor: 'default', fontSize: 12, color: 'var(--ink-3)' }}>
              Nicht unterstützt in diesem Browser
            </div>
          )}
          {pushStatus === 'denied' && (
            <div className="dropdown-item" style={{ cursor: 'default', fontSize: 12, color: 'var(--down)' }}>
              Berechtigung verweigert — bitte Browser-Einstellungen prüfen
            </div>
          )}
          {pushStatus === 'default' && (
            <div className="dropdown-item" onClick={() => { subscribePush(setPushStatus); onClose(); }}
              style={{ color: 'var(--accent)', fontWeight: 500 }}>
              <span style={{ fontSize: 14 }}>🔔</span>
              <div>
                <div style={{ fontSize: 12.5 }}>Benachrichtigungen aktivieren</div>
                {isIOS && !isStandalone && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>iPhone: erst "Zum Home-Bildschirm" hinzufügen</div>
                )}
              </div>
            </div>
          )}
          {pushStatus === 'subscribed' && (
            <>
              <div className="dropdown-item" style={{ cursor: 'default' }}>
                <span style={{ color: 'var(--up)', fontSize: 13 }}>🔔</span>
                <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>Aktiv · täglich 06:00 UTC</div>
              </div>
              <div className="dropdown-item danger" onClick={() => { unsubscribePush(setPushStatus); onClose(); }}>
                <span style={{ fontSize: 13 }}>✕</span>
                <div style={{ fontSize: 12.5 }}>Deaktivieren</div>
              </div>
            </>
          )}
        </div>

        <div className="dropdown-section">
          <div className="dropdown-item" style={{ cursor: 'default', fontSize: 11, color: 'var(--ink-3)', paddingTop: 6, paddingBottom: 6 }}>
            Nächste Aktu. täglich um 06:00 UTC
          </div>
        </div>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────
// Main App
// ──────────────────────────────────────────────
function App() {
  const [route, setRoute]   = useStateA('overview');
  const [theme, setTheme]   = useStateA(() => localStorage.getItem('bfs-theme') || 'light');
  const [dataStatus, setDataStatus] = useStateA('loading');
  const [updatedAt, setUpdatedAt]   = useStateA(null);
  const [tick, setTick]             = useStateA(0);
  const [showNotif, setShowNotif]   = useStateA(false);
  const [showApiModal, setShowApiModal] = useStateA(false);
  const [pushStatus, setPushStatus] = useStateA('unknown');
  const [sidebarOpen, setSidebarOpen] = useStateA(false);

  useEffectA(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bfs-theme', theme);
  }, [theme]);

  // Fetch live data from cache on load
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

  // Check push subscription state on load
  useEffectA(() => {
    getPushState().then(setPushStatus);
  }, []);

  // Keyboard shortcuts
  useEffectA(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const hit = NAV.find(n => n.kbd.toLowerCase() === k);
      if (hit) setRoute(hit.id);
      if (k === 't') setTheme(t => t === 'dark' ? 'light' : 'dark');
      if (e.key === 'Escape') { setShowNotif(false); setShowApiModal(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Sections = {
    overview:     () => <OverviewSection onGoTo={setRoute} dataStatus={dataStatus} />,
    wirtschaft:   WirtschaftSection,
    arbeit:       ArbeitSection,
    preise:       PreiseSection,
    bevoelkerung: BevoelkerungSection,
    analyse:      AnalyseSection,
  };
  const Current    = Sections[route];
  const currentNav = NAV.find(n => n.id === route);

  const lastSync = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) + ' UTC'
    : '—';

  const hasBadge = pushStatus === 'subscribed' || dataStatus === 'live';

  return (
    <div className="app">
      {/* SIDEBAR BACKDROP (mobile) */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">+</div>
          <div>
            <div className="brand-name">Statistik Hub</div>
            <div className="brand-sub">BFS · SECO · SNB</div>
          </div>
        </div>

        <div className="nav-section">Dashboard</div>
        {NAV.map(n => (
          <div key={n.id} className={`nav-item ${route === n.id ? 'active' : ''}`} onClick={() => { setRoute(n.id); setSidebarOpen(false); }}>
            <span className="nav-dot" />
            <span>{n.label}</span>
            <span className="nav-shortcut">{n.kbd}</span>
          </div>
        ))}

        <div className="nav-section">Werkzeuge</div>
        <div className="nav-item" onClick={() => setRoute('preise')}>
          <span className="nav-dot" /><span>Kaufkraft-Rechner</span><span className="nav-shortcut">P</span>
        </div>
        <div className="nav-item" onClick={exportCSV}>
          <span className="nav-dot" /><span>Export CSV</span>
        </div>
        <div className="nav-item" onClick={() => setShowApiModal(true)}>
          <span className="nav-dot" /><span>API-Zugriff</span>
        </div>

        <div className="nav-section">Status</div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span className={`tag ${dataStatus === 'live' ? 'live' : ''}`}>
              {dataStatus === 'loading' ? '…' : dataStatus === 'live' ? 'live' : 'static'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono' }}>
            {dataStatus === 'live'
              ? <>Last sync · {lastSync}<br />Nächste Aktu. · 06:00 UTC</>
              : dataStatus === 'loading' ? 'Lade Live-Daten …' : 'Statische Daten (Fallback)'
            }
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          {/* Hamburger (mobile only) */}
          <button className="hamburger" onClick={() => setSidebarOpen(v => !v)} title="Menü">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
            </svg>
          </button>

          <div className="crumb">
            Statistik Hub <span style={{ margin: '0 6px', color: 'var(--ink-4)' }}>/</span>
            <b>{currentNav.label}</b>
          </div>

          {/* Theme toggle */}
          <button className="icon-btn" title="Theme wechseln (T)" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark'
              ? <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" strokeLinecap="round" /></svg>
              : <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 9.5A6 6 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" strokeLinejoin="round" /></svg>
            }
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button className="icon-btn" title="Benachrichtigungen" style={{ position: 'relative' }}
              onClick={() => setShowNotif(v => !v)}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6a4 4 0 0 1 8 0v3l1.5 2.5h-11L4 9V6z" strokeLinejoin="round" />
                <path d="M6.5 13a1.5 1.5 0 0 0 3 0" />
              </svg>
              {hasBadge && <span className="notif-badge" />}
            </button>
            {showNotif && (
              <NotificationDropdown
                updatedAt={updatedAt}
                pushStatus={pushStatus}
                setPushStatus={setPushStatus}
                onClose={() => setShowNotif(false)}
              />
            )}
          </div>
        </div>

        <div className="content">
          <Current />
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--line)',
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 11, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono' }}>
            <span>Quellen: BFS · SECO · SNB · Eidg. Zollverwaltung</span>
            <span>BFS Statistik Hub v0.6</span>
          </div>
        </div>
      </div>

      {showApiModal && <ApiModal onClose={() => setShowApiModal(false)} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
