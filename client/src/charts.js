// Season-by-season charts, drawn as SVG at the container's measured width so
// text stays at its real size. Each season is one focusable group: hovering or
// focusing it shows every value for that season. The same numbers are always
// available as a table (SeasonTable), so the tooltip never gates a value.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { BREAK_EVEN, pct } from './format';
import { wilson, Z } from './stats';

const M = { top: 18, right: 8, bottom: 26, left: 40 };

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    setWidth(Math.floor(ref.current.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** "2006–07" -> "06–07" for axis labels. */
const shortSeason = y => `${String(y % 100).padStart(2, '0')}–${String((y + 1) % 100).padStart(2, '0')}`;
const fullSeason = y => `${y}–${String((y + 1) % 100).padStart(2, '0')}`;

/** Rounded-top column path: square at the baseline, 4px radius at the data end. */
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * The shared frame: y scale, gridlines, season axis, hit areas and tooltip.
 * `marks(scale)` draws the data; `tip(row)` returns the tooltip lines.
 */
function SeasonFrame({ rows, height = 200, domain, ticks, yFormat, marks, tip, label, legend }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const band = rows.length ? plotW / rows.length : 0;
  const [lo, hi] = domain;
  const y = v => M.top + plotH - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * plotH;
  const x = i => M.left + i * band + band / 2;
  const every = Math.max(1, Math.ceil(46 / Math.max(band, 1)));
  const scale = { x, y, band, plotH, baseline: y(lo) };
  const activeRow = active != null ? rows[active] : null;

  return (
    <div className="chart" ref={ref}>
      {legend}
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label={label}>
          {ticks.map(t => (
            <g key={t}>
              <line className="chart__grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
              <text className="chart__tick" x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{yFormat(t)}</text>
            </g>
          ))}
          {marks(scale, active)}
          {rows.map((r, i) => (
            <g key={r.season}
              tabIndex={0}
              role="img"
              aria-label={`${fullSeason(r.season)}: ${tip(r).join(', ')}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(a => (a === i ? null : a))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(a => (a === i ? null : a))}
              className="chart__hit">
              <rect x={M.left + i * band} y={M.top} width={band} height={plotH} />
              {i % every === 0 && (
                <text className="chart__season" x={x(i)} y={height - 8} textAnchor="middle">{shortSeason(r.season)}</text>
              )}
            </g>
          ))}
        </svg>
      )}
      {activeRow && (
        // Beside the season, inside the plot, so it never covers the headings.
        <div className={`chart__tip${x(active) > width / 2 ? ' is-left' : ''}`} aria-hidden="true"
          style={{ left: x(active) + (x(active) > width / 2 ? -band / 2 - 6 : band / 2 + 6), top: M.top + (legend ? 30 : 0) }}>
          <strong>{fullSeason(activeRow.season)}</strong>
          {tip(activeRow).map(line => <span key={line}>{line}</span>)}
        </div>
      )}
    </div>
  );
}

/** One value per season as columns from zero. */
export function SeasonColumns({ rows, value, domain, ticks, yFormat, tip, label }) {
  return (
    <SeasonFrame rows={rows} domain={domain} ticks={ticks} yFormat={yFormat} tip={tip} label={label}
      marks={(s, active) => rows.map((r, i) => {
        const v = value(r);
        if (v == null) return null;
        const w = Math.min(24, s.band - 4);
        const top = s.y(v);
        return (
          <path key={r.season} className={`chart__column${active === i ? ' is-active' : ''}`}
            d={columnPath(s.x(i) - w / 2, top, w, s.baseline - top)} />
        );
      })} />
  );
}

/** Round an interval's range out to a tidy axis, at least 30%–75%. */
const rateAxis = rows => {
  const lows = rows.map(r => r.low);
  const highs = rows.map(r => r.high);
  const lo = Math.max(0, Math.min(0.3, Math.floor(Math.min(...lows) * 10) / 10));
  const hi = Math.min(1, Math.max(0.75, Math.ceil(Math.max(...highs) * 10) / 10));
  return [lo, hi];
};

/**
 * A rate per season with its Wilson 95% interval, against the 52.4% needed to
 * profit at -110. rows: [{ season, k, n }] (seasons without games are skipped).
 */
export function SeasonRates({ rows: raw, label, what }) {
  const rows = raw.filter(r => r.n > 0).map(r => {
    const [low, high] = wilson(r.k, r.n);
    return { ...r, rate: r.k / r.n, low, high };
  });
  if (rows.length === 0) return null;
  const domain = rateAxis(rows);
  const ticks = [];
  for (let t = Math.ceil(domain[0] * 10) / 10; t <= domain[1] + 1e-9; t += 0.1) ticks.push(Number(t.toFixed(1)));
  return (
    <SeasonFrame rows={rows} height={220} domain={domain} ticks={ticks} yFormat={t => pct(t, 0)} label={label}
      legend={(
        <div className="chart__legend" aria-hidden="true">
          <span><i className="key key--dot is-beat" />Above break-even</span>
          <span><i className="key key--dot" />Below</span>
          <span><i className="key key--whisker" />95% interval</span>
          <span><i className="key key--line" />Break-even {pct(BREAK_EVEN)}</span>
        </div>
      )}
      tip={r => [`${pct(r.rate)} ${what}`, `${r.k} of ${r.n}`, `95% interval ${pct(r.low)}–${pct(r.high)}`]}
      marks={(s, active) => (
        <>
          <line className="chart__ref" x1={M.left} x2={M.left + s.band * rows.length} y1={s.y(BREAK_EVEN)} y2={s.y(BREAK_EVEN)} />
          {rows.map((r, i) => (
            <g key={r.season} className={active === i ? 'is-active' : ''}>
              <line className="chart__whisker" x1={s.x(i)} x2={s.x(i)} y1={s.y(r.low)} y2={s.y(r.high)} />
              <circle className={`chart__dot${r.rate > BREAK_EVEN ? ' is-beat' : ''}`} cx={s.x(i)} cy={s.y(r.rate)} r={4.5} />
            </g>
          ))}
        </>
      )} />
  );
}

/** The table twin of a season chart: columns [{ label, value: row -> text, num }]. */
export function SeasonTable({ rows, columns }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Season</th>
            {columns.map(c => <th key={c.label} scope="col" className="num">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.season}>
              <th scope="row">{fullSeason(r.season)}</th>
              {columns.map(c => <td key={c.label} className="num">{c.value(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------- cumulative profit */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Round numbers for an axis spanning [lo, hi]: about five steps of 1, 2 or 5 × 10^k. */
function niceTicks(lo, hi) {
  const span = hi - lo || 1;
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const ticks = [];
  for (let t = Math.floor(lo / step) * step; t <= hi + step * 1e-6; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

/**
 * Running profit of $100 bets, month by month, over a band showing where a
 * bettor with no edge (winning exactly the break-even rate) would be 95% of the
 * time after the same number of bets. rows: per-month totals in date order.
 */
export function ProfitChart({ rows, sd, format, label }) {
  const [ref, width] = useWidth();
  const [active, setActive] = useState(null);
  const height = 260;
  const m = { top: 16, right: 12, bottom: 28, left: 64 };
  const plotW = Math.max(0, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;

  let bets = 0;
  let profit = 0;
  const points = rows.map(r => {
    bets += r.bets;
    profit += r.profit;
    return { ...r, cumBets: bets, cumProfit: profit, band: Z * sd * Math.sqrt(bets) * 1 };
  });
  const values = points.flatMap(p => [p.cumProfit, p.band, -p.band]);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values));
  const [lo, hi] = [ticks[0], ticks[ticks.length - 1]];
  const x = i => m.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = v => m.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.cumProfit)}`).join('');
  const band = `${points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.band)}`).join('')}${points
    .map((p, i) => `L${x(points.length - 1 - i)},${y(-points[points.length - 1 - i].band)}`).join('')}Z`;
  const seasonStarts = points.map((p, i) => (i === 0 || p.season !== points[i - 1].season ? i : null)).filter(i => i != null);
  const everySeason = Math.max(1, Math.ceil(48 / Math.max(1, plotW / Math.max(1, seasonStarts.length))));
  const last = points[points.length - 1];

  const nearest = clientX => {
    const box = ref.current.getBoundingClientRect();
    const t = (clientX - box.left - m.left) / Math.max(plotW, 1);
    return Math.max(0, Math.min(points.length - 1, Math.round(t * (points.length - 1))));
  };
  const a = active != null ? points[active] : null;

  return (
    <div className="chart" ref={ref}>
      <div className="chart__legend" aria-hidden="true">
        <span><i className="key key--line key--thick" />Running total</span>
        <span><i className="key key--band" />Where no edge would be, 95% of the time</span>
      </div>
      {width > 0 && points.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} tabIndex={0}
          onPointerMove={e => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(a2 => (a2 == null ? points.length - 1 : a2))}
          onBlur={() => setActive(null)}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft') setActive(i => Math.max(0, (i == null ? points.length : i) - 1));
            if (e.key === 'ArrowRight') setActive(i => Math.min(points.length - 1, (i == null ? -1 : i) + 1));
          }}>
          {ticks.map(t => (
            <g key={t}>
              <line className={t === 0 ? 'chart__zero' : 'chart__grid'} x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} />
              <text className="chart__tick" x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
            </g>
          ))}
          <path className="chart__band" d={band} />
          <path className="chart__line" d={line} />
          {seasonStarts.filter((_, k) => k % everySeason === 0).map(i => (
            <text key={i} className="chart__season" x={x(i)} y={height - 8} textAnchor="start">{shortSeason(points[i].season)}</text>
          ))}
          <circle className={`chart__dot${last.cumProfit > 0 ? ' is-beat' : ''}`} cx={x(points.length - 1)} cy={y(last.cumProfit)} r={4.5} />
          {a && (
            <g className="chart__cross">
              <line x1={x(active)} x2={x(active)} y1={m.top} y2={m.top + plotH} />
              <circle cx={x(active)} cy={y(a.cumProfit)} r={4.5} />
            </g>
          )}
        </svg>
      )}
      {a && (
        <div className={`chart__tip${x(active) > width / 2 ? ' is-left' : ''}`} aria-hidden="true"
          style={{ left: x(active) + (x(active) > width / 2 ? -10 : 10), top: m.top + 30 }}>
          <strong>{MONTHS[a.month - 1]} {a.year}</strong>
          <span>{format(a.cumProfit)} after {a.cumBets.toLocaleString('en-US')} bets</span>
          <span>No-edge range {format(-a.band)} to {format(a.band)}</span>
        </div>
      )}
    </div>
  );
}
