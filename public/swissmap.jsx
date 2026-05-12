// SwissMap — echte Kantonsgrenzen, fetch von unpkg/swiss-maps zur Laufzeit
const { useState: useStateM, useEffect: useEffectM, useRef: useRefM, useMemo: useMemoM } = React;

// Mapping BFS canton ID → ISO code
const CANTON_ID_TO_CODE = {
  1: 'ZH', 2: 'BE', 3: 'LU', 4: 'UR', 5: 'SZ', 6: 'OW', 7: 'NW', 8: 'GL', 9: 'ZG',
  10: 'FR', 11: 'SO', 12: 'BS', 13: 'BL', 14: 'SH', 15: 'AR', 16: 'AI', 17: 'SG',
  18: 'GR', 19: 'AG', 20: 'TG', 21: 'TI', 22: 'VD', 23: 'VS', 24: 'NE', 25: 'GE', 26: 'JU',
};

// Cache
let _topoCache = null;
async function loadSwissTopo() {
  if (_topoCache) return _topoCache;
  const url = 'https://unpkg.com/swiss-maps@4/2021/ch-combined.json';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load map');
  const topo = await res.json();
  _topoCache = topo;
  return topo;
}

// Equirectangular projection — swiss-maps@4 ships WGS84 lat/lng
const PROJ = (() => {
  const lngMin = 5.96, lngMax = 10.49, latMin = 45.82, latMax = 47.81;
  const latMid = (latMin + latMax) / 2;
  const cosLat = Math.cos(latMid * Math.PI / 180);
  const VB_W = 960, VB_H = 500;
  const lngRange = (lngMax - lngMin) * cosLat;
  const latRange = latMax - latMin;
  const scale = Math.min(VB_W / lngRange, VB_H / latRange) * 0.96;
  const projW = lngRange * scale, projH = latRange * scale;
  const xOff = (VB_W - projW) / 2 - lngMin * cosLat * scale;
  const yOff = (VB_H - projH) / 2 + latMax * scale;
  return {
    project: (lng, lat) => [lng * cosLat * scale + xOff, yOff - lat * scale],
    VB_W, VB_H,
  };
})();

// Convert GeoJSON polygon coordinates → SVG path (with projection)
function geoToPath(geom) {
  if (!geom) return '';
  const rings = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return rings.map(poly =>
    poly.map(ring =>
      ring.map(([lng, lat], i) => {
        const [x, y] = PROJ.project(lng, lat);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ') + 'Z'
    ).join(' ')
  ).join(' ');
}

function SwissMap({ data, onHover, valueLabel = '%' }) {
  const [features, setFeatures] = useStateM(null);
  const [country, setCountry] = useStateM(null);
  const [lakes, setLakes] = useStateM(null);
  const [error, setError] = useStateM(null);
  const [transform, setTransform] = useStateM({ x: 0, y: 0, k: 1 });
  const [hovered, setHovered] = useStateM(null);
  const [pos, setPos] = useStateM({ x: 0, y: 0 });
  const wrapRef = useRefM(null);
  const dragRef = useRefM(null);

  useEffectM(() => {
    let cancelled = false;
    loadSwissTopo().then(topo => {
      if (cancelled) return;
      const tj = window.topojson;
      const cantons = tj.feature(topo, topo.objects.cantons);
      const ch = tj.feature(topo, topo.objects.country);
      const lk = topo.objects.lakes ? tj.feature(topo, topo.objects.lakes) : null;
      setFeatures(cantons.features);
      setCountry(ch);
      setLakes(lk);
    }).catch(e => setError(e.message));
    return () => { cancelled = true; };
  }, []);

  const byCode = useMemoM(() => Object.fromEntries(data.map(d => [d.code, d])), [data]);
  const max = useMemoM(() => Math.max(...data.map(d => d.value)), [data]);
  const min = useMemoM(() => Math.min(...data.map(d => d.value)), [data]);

  const colorFor = v => {
    if (v == null) return 'var(--bg-elev)';
    const t = (v - min) / (max - min || 1);
    return `oklch(${(93 - t * 38).toFixed(1)}% ${(0.04 + t * 0.18).toFixed(3)} 25)`;
  };

  // Mouse pan/zoom
  const onWheel = e => {
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const dk = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    setTransform(t => {
      const newK = Math.max(1, Math.min(8, t.k * dk));
      const ratio = newK / t.k;
      return {
        k: newK,
        x: mx - (mx - t.x) * ratio,
        y: my - (my - t.y) * ratio,
      };
    });
  };
  const onMouseDown = e => {
    dragRef.current = { x: e.clientX, y: e.clientY, t: transform };
  };
  const onMouseMove = e => {
    if (dragRef.current) {
      const d = dragRef.current;
      setTransform({ k: d.t.k, x: d.t.x + (e.clientX - d.x), y: d.t.y + (e.clientY - d.y) });
    }
    const rect = wrapRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onMouseUp = () => { dragRef.current = null; };
  const reset = () => setTransform({ x: 0, y: 0, k: 1 });
  const zoomIn = () => setTransform(t => ({ ...t, k: Math.min(8, t.k * 1.4) }));
  const zoomOut = () => setTransform(t => ({ ...t, k: Math.max(1, t.k / 1.4) }));

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>Karte konnte nicht geladen werden: {error}</div>;
  if (!features) return (
    <div style={{ height: 380, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 18, height: 18, border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span className="mono">Lade Kantonsgrenzen …</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const VB_W = 960, VB_H = 500;
  const aspectStyle = { width: '100%', aspectRatio: `${VB_W} / ${VB_H}`, position: 'relative', overflow: 'hidden', borderRadius: 8, background: 'var(--bg-elev)', cursor: dragRef.current ? 'grabbing' : 'grab', userSelect: 'none' };

  return (
    <div>
      <div ref={wrapRef} style={aspectStyle}
           onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
           onMouseUp={onMouseUp} onMouseLeave={() => { onMouseUp(); setHovered(null); onHover && onHover(null); }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height="100%" style={{ display: 'block' }}>
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            {country && <path d={geoToPath(country.geometry)} fill="var(--bg-card)" stroke="var(--line-2)" strokeWidth={0.6 / transform.k} />}
            {features.map(f => {
              const code = CANTON_ID_TO_CODE[f.id];
              const d = byCode[code];
              const isHovered = hovered === code;
              return (
                <path key={f.id}
                  d={geoToPath(f.geometry)}
                  fill={colorFor(d ? d.value : null)}
                  stroke={isHovered ? 'var(--ink)' : 'var(--bg-card)'}
                  strokeWidth={isHovered ? 1.6 / transform.k : 0.5 / transform.k}
                  style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                  onMouseEnter={() => { setHovered(code); onHover && onHover(d); }}
                  onMouseLeave={() => { setHovered(null); onHover && onHover(null); }}
                />
              );
            })}
            {lakes && <path d={geoToPath(lakes.geometry)} fill="var(--info-soft)" stroke="var(--info)" strokeWidth={0.4 / transform.k} opacity={0.7} />}
            {/* Canton code labels — visible at zoom > 1.4 */}
            {transform.k > 1.4 && features.map(f => {
              const code = CANTON_ID_TO_CODE[f.id];
              const d = byCode[code];
              const bbox = bboxOf(f.geometry);
              if (!bbox) return null;
              const [cx, cy] = PROJ.project((bbox.x0 + bbox.x1) / 2, (bbox.y0 + bbox.y1) / 2);
              const t = d ? (d.value - min) / (max - min || 1) : 0;
              return (
                <text key={f.id + 'lbl'} x={cx} y={cy} textAnchor="middle"
                      fontSize={6 / Math.sqrt(transform.k)}
                      fill={t > 0.55 ? 'rgba(255,255,255,0.95)' : 'var(--ink)'}
                      fontFamily="IBM Plex Mono" fontWeight={600}
                      style={{ pointerEvents: 'none' }}>
                  {code}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Floating tooltip */}
        {hovered && byCode[hovered] && (
          <div style={{
            position: 'absolute',
            left: Math.min(pos.x + 14, (wrapRef.current?.clientWidth || 600) - 180),
            top: Math.max(8, pos.y - 60),
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '10px 12px', borderRadius: 8, fontSize: 12,
            pointerEvents: 'none', minWidth: 150,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ opacity: 0.6, fontSize: 10.5, fontFamily: 'IBM Plex Mono', letterSpacing: '0.05em' }}>{byCode[hovered].code}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>Apr 2025</span>
            </div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{byCode[hovered].name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Arbeitslosigkeit</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 16, fontWeight: 500 }}>{byCode[hovered].value.toFixed(1)}{valueLabel}</span>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0' }} />
            <div style={{ fontSize: 10.5, opacity: 0.7, fontFamily: 'IBM Plex Mono' }}>
              vs. Ø Schweiz: {(byCode[hovered].value - data.reduce((s, k) => s + k.value, 0) / data.length).toFixed(1)}pp
            </div>
          </div>
        )}

        {/* Zoom controls */}
        <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button className="icon-btn" onClick={zoomIn} title="Zoom in">+</button>
          <button className="icon-btn" onClick={zoomOut} title="Zoom out">−</button>
          <button className="icon-btn" onClick={reset} title="Reset" style={{ fontSize: 10 }}>⊙</button>
        </div>

        {/* Hint */}
        <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--line)' }}>
          Scroll = Zoom · Drag = Pan · Hover = Detail
        </div>

        {/* Zoom indicator */}
        <div style={{ position: 'absolute', right: 12, bottom: 12, fontSize: 10.5, color: 'var(--ink-3)', fontFamily: 'IBM Plex Mono' }}>
          {(transform.k).toFixed(1)}×
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 11.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ color: 'var(--ink-3)' }}>{min.toFixed(1)}{valueLabel}</span>
          <span style={{ width: 140, height: 10, background: `linear-gradient(to right, ${colorFor(min)}, ${colorFor((min + max) / 2)}, ${colorFor(max)})`, borderRadius: 2 }} />
          <span className="mono" style={{ color: 'var(--ink-3)' }}>{max.toFixed(1)}{valueLabel}</span>
        </div>
        <div style={{ display: 'flex', gap: 18, color: 'var(--ink-3)' }}>
          <span>Ø <b className="mono" style={{ color: 'var(--ink)' }}>{(data.reduce((s, k) => s + k.value, 0) / data.length).toFixed(2)}{valueLabel}</b></span>
          <span>Tiefster: <b className="mono" style={{ color: 'var(--ink)' }}>{data.find(d => d.value === min).code} ({min.toFixed(1)})</b></span>
          <span>Höchster: <b className="mono" style={{ color: 'var(--ink)' }}>{data.find(d => d.value === max).code} ({max.toFixed(1)})</b></span>
        </div>
      </div>
    </div>
  );
}

function bboxOf(geom) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const each = poly => poly.forEach(ring => ring.forEach(([x, y]) => {
    if (x < x0) x0 = x; if (y < y0) y0 = y;
    if (x > x1) x1 = x; if (y > y1) y1 = y;
  }));
  if (geom.type === 'Polygon') each(geom.coordinates);
  else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(each);
  if (!isFinite(x0)) return null;
  return { x0, y0, x1, y1 };
}

Object.assign(window, { SwissMap });
