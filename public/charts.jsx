// Chart-Primitiven für BFS Dashboard
const { useState, useMemo, useRef, useEffect } = React;

// ============ Sparkline ============
function Sparkline({ data, w = 80, h = 24, color = 'currentColor', fill = false }) {
  const vals = data.map(d => (typeof d === 'object' ? d.v : d));
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area = fill ? `${d} L${w},${h} L0,${h} Z` : null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {area && <path d={area} fill={color} opacity={0.12} />}
      <path d={d} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============ Line / Area Chart ============
function AreaChart({ data, xKey, yKey, h = 220, color, label, formatY, formatX, yMin, yMax, baseline = 0, showAxes = true, multi, unit = '', annotation }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const pad = { l: showAxes ? 38 : 8, r: 12, t: 14, b: showAxes ? 26 : 8 };
  const innerW = Math.max(0, w - pad.l - pad.r);
  const innerH = h - pad.t - pad.b;

  const series = multi || [{ data, key: yKey, color, label }];
  const allY = series.flatMap(s => s.data.map(d => d[s.key]));
  const computedMin = yMin !== undefined ? yMin : Math.min(...allY, baseline);
  const computedMax = yMax !== undefined ? yMax : Math.max(...allY);
  const range = computedMax - computedMin || 1;

  const xAt = (i, len) => pad.l + (i / (len - 1)) * innerW;
  const yAt = v => pad.t + innerH - ((v - computedMin) / range) * innerH;

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => computedMin + (range * i) / ticks);

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {/* gridlines */}
        {showAxes && yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={yAt(t)} y2={yAt(t)} stroke="var(--line)" strokeDasharray={i === 0 ? '0' : '2 3'} />
            <text x={pad.l - 8} y={yAt(t) + 3} fill="var(--ink-3)" fontSize="10" textAnchor="end" fontFamily="IBM Plex Mono">
              {formatY ? formatY(t) : t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* x-axis labels */}
        {showAxes && data && data.map((d, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 8) !== 0 && i !== data.length - 1) return null;
          return (
            <text key={i} x={xAt(i, data.length)} y={h - pad.b + 14} fill="var(--ink-3)" fontSize="10" textAnchor="middle" fontFamily="IBM Plex Mono">
              {String(d[xKey]).slice(-4) === String(d[xKey]) ? d[xKey] : String(d[xKey]).replace(/^20/, '')}
            </text>
          );
        })}
        {/* series */}
        {series.map((s, si) => {
          const pts = s.data.map((d, i) => [xAt(i, s.data.length), yAt(d[s.key])]);
          const dPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
          const areaPath = `${dPath} L${pts[pts.length - 1][0]},${yAt(baseline)} L${pts[0][0]},${yAt(baseline)} Z`;
          return (
            <g key={si}>
              {!multi && <path d={areaPath} fill={s.color || 'var(--accent)'} opacity={0.08} />}
              <path d={dPath} stroke={s.color || 'var(--accent)'} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 3.5 : 0} fill={s.color || 'var(--accent)'} />
              ))}
            </g>
          );
        })}
        {/* hover overlay */}
        {data && data.map((d, i) => (
          <rect key={i} x={xAt(i, data.length) - innerW / data.length / 2} y={pad.t}
                width={innerW / data.length} height={innerH}
                fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
        {/* hover line */}
        {hover !== null && data && (
          <line x1={xAt(hover, data.length)} x2={xAt(hover, data.length)} y1={pad.t} y2={pad.t + innerH} stroke="var(--ink-3)" strokeDasharray="2 2" />
        )}
      </svg>
      {hover !== null && data && (() => {
        const cx = xAt(hover, data.length);
        const tipW = 200;
        const left = cx + tipW + 12 > w ? cx - tipW - 12 : cx + 12;
        const prev = hover > 0 ? data[hover - 1] : null;
        return (
          <div style={{
            position: 'absolute',
            left: Math.max(8, Math.min(w - tipW - 8, left)),
            top: 8,
            background: 'var(--ink)', color: 'var(--bg)',
            padding: '10px 12px', borderRadius: 8, fontSize: 12, pointerEvents: 'none',
            minWidth: tipW, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ opacity: 0.6, fontSize: 10.5, fontFamily: 'IBM Plex Mono', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{formatX ? formatX(data[hover][xKey]) : data[hover][xKey]}</span>
              <span style={{ fontSize: 10, opacity: 0.55, fontFamily: 'IBM Plex Mono' }}>{hover + 1}/{data.length}</span>
            </div>
            {series.map((s, si) => {
              const v = data[hover][s.key];
              const prevV = prev ? prev[s.key] : null;
              const delta = prevV != null ? v - prevV : null;
              return (
                <div key={si} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '3px 0' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, opacity: 0.85 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color || 'var(--accent)' }} />
                    {s.label || 'Wert'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, fontSize: 14 }}>{formatY ? formatY(v) : v}</span>
                    {delta != null && (
                      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10.5, opacity: 0.65, color: delta >= 0 ? 'oklch(85% 0.18 145)' : 'oklch(80% 0.16 25)' }}>
                        {delta >= 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(Math.abs(delta) < 1 ? 2 : 1)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
            {annotation && annotation(data[hover], hover) && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: 10.5, opacity: 0.7, fontFamily: 'IBM Plex Mono' }}>
                {annotation(data[hover], hover)}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ============ Bar Chart (horizontal) ============
function BarChartH({ data, labelKey, valueKey, formatV, color = 'var(--accent)', sortDesc = true, max }) {
  const sorted = sortDesc ? [...data].sort((a, b) => b[valueKey] - a[valueKey]) : data;
  const maxV = max !== undefined ? max : Math.max(...sorted.map(d => d[valueKey]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sorted.map((d, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <div style={{ color: 'var(--ink-2)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d[labelKey]}</div>
          <div style={{ height: 14, background: 'var(--bg-elev)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%',
              width: `${(d[valueKey] / maxV) * 100}%`,
              background: typeof color === 'function' ? color(d, i) : color,
              transition: 'width 0.4s cubic-bezier(.2,.8,.2,1)',
            }} />
          </div>
          <div className="mono" style={{ textAlign: 'right', color: 'var(--ink)' }}>{formatV ? formatV(d[valueKey]) : d[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}

// ============ Vertical Bar (diverging for inflation drivers) ============
function DivergingBars({ data, h = 220 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 8, r: 8, t: 14, b: 44 };
  const innerW = Math.max(0, w - pad.l - pad.r);
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...data.map(d => Math.abs(d.value))) * 1.15;
  const bw = innerW / data.length * 0.62;
  const gap = innerW / data.length;
  const zero = pad.t + innerH / 2;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <line x1={pad.l} x2={w - pad.r} y1={zero} y2={zero} stroke="var(--line-2)" />
        {data.map((d, i) => {
          const x = pad.l + gap * i + gap / 2 - bw / 2;
          const barH = (Math.abs(d.value) / max) * (innerH / 2);
          const y = d.value >= 0 ? zero - barH : zero;
          const color = d.value >= 0 ? 'var(--accent)' : 'var(--info)';
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={barH} fill={color} rx={2} />
              <text x={x + bw / 2} y={d.value >= 0 ? y - 4 : y + barH + 11} fill="var(--ink-2)" fontSize="10" textAnchor="middle" fontFamily="IBM Plex Mono">
                {d.value > 0 ? '+' : ''}{d.value.toFixed(2)}
              </text>
              <text x={x + bw / 2} y={h - 22} fill="var(--ink-3)" fontSize="10" textAnchor="middle">
                <tspan>{d.cat.split(' ')[0]}</tspan>
                {d.cat.split(' ')[1] && <tspan x={x + bw / 2} dy="11">{d.cat.split(' ').slice(1).join(' ')}</tspan>}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============ Bevölkerungspyramide ============
function Pyramide({ data, h = 280 }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => setW(entries[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const labelW = 56;
  const innerW = (w - labelW) / 2;
  const max = Math.max(...data.flatMap(d => [d.m, d.w]));
  const rowH = (h - 30) / data.length;
  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <text x={labelW / 2 + innerW / 2} y={14} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" fontFamily="IBM Plex Mono">MÄNNER</text>
        <text x={labelW / 2 + innerW + innerW / 2 + labelW / 2} y={14} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)" fontFamily="IBM Plex Mono">FRAUEN</text>
        {data.map((d, i) => {
          const y = 22 + i * rowH;
          const mBar = (d.m / max) * (innerW - 4);
          const wBar = (d.w / max) * (innerW - 4);
          return (
            <g key={i}>
              <rect x={labelW + innerW - mBar} y={y} width={mBar} height={rowH * 0.78} fill="var(--info)" rx={2} />
              <rect x={labelW + innerW + labelW} y={y} width={wBar} height={rowH * 0.78} fill="var(--accent)" rx={2} />
              <text x={labelW + innerW + labelW / 2} y={y + rowH * 0.56} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)" fontFamily="IBM Plex Mono">{d.age}</text>
              <text x={labelW + innerW - mBar - 6} y={y + rowH * 0.56} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="IBM Plex Mono">{d.m}</text>
              <text x={labelW + innerW + labelW + wBar + 6} y={y + rowH * 0.56} fontSize="10" fill="var(--ink-3)" fontFamily="IBM Plex Mono">{d.w}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============ Donut für Mix ============
function Donut({ data, size = 140, valueKey = 'share', labelKey = 'name', colors }) {
  const total = data.reduce((s, d) => s + d[valueKey], 0);
  let acc = 0;
  const cx = size / 2, cy = size / 2, r = size / 2 - 6, ir = r - 14;
  const defaultColors = ['var(--accent)', 'var(--info)', 'var(--warn)', 'var(--up)', 'var(--ink-2)', 'var(--ink-3)', 'var(--ink-4)', 'var(--line-2)', 'var(--accent-soft)', 'var(--info-soft)'];
  return (
    <svg width={size} height={size}>
      {data.map((d, i) => {
        const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
        acc += d[valueKey];
        const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
        const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
        const x2 = cx + ir * Math.cos(a1), y2 = cy + ir * Math.sin(a1);
        const x3 = cx + ir * Math.cos(a0), y3 = cy + ir * Math.sin(a0);
        return <path key={i} d={`M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ir},${ir} 0 ${large} 0 ${x3},${y3} Z`}
                     fill={(colors || defaultColors)[i % (colors || defaultColors).length]} />;
      })}
    </svg>
  );
}

// ============ Mini stacked bar timeline ============
function StackedBars({ data, keys, colors, h = 180, formatY, xKey }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(400);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const pad = { l: 32, r: 8, t: 10, b: 22 };
  const innerW = Math.max(0, w - pad.l - pad.r);
  const innerH = h - pad.t - pad.b;
  const totals = data.map(d => keys.reduce((s, k) => s + Math.abs(d[k]), 0));
  const max = Math.max(...totals) * 1.1;
  const bw = innerW / data.length * 0.65;
  const gap = innerW / data.length;
  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <line x1={pad.l} x2={w - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="var(--line-2)" />
        {[0, 0.5, 1].map((t, i) => {
          const v = max * t;
          const y = pad.t + innerH - (v / max) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray={i === 0 ? '0' : '2 3'} />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="IBM Plex Mono">{formatY ? formatY(v) : v.toFixed(0)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          let yAcc = pad.t + innerH;
          const x = pad.l + gap * i + (gap - bw) / 2;
          return (
            <g key={i}>
              {keys.map((k, ki) => {
                const v = d[k];
                const hh = (v / max) * innerH;
                yAcc -= hh;
                return <rect key={ki} x={x} y={yAcc} width={bw} height={hh} fill={colors[ki]} />;
              })}
              <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize="10" fill="var(--ink-3)" fontFamily="IBM Plex Mono">{d[xKey]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Make components globally available
Object.assign(window, { Sparkline, AreaChart, BarChartH, DivergingBars, Pyramide, Donut, StackedBars });
