// Shared building blocks: hooks, icons, the list/detail layout and the two
// "against the line" graphics.
import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';


/* ------------------------------------------------------------------ hooks */

const sticky = new Map();

/** useState that survives switching views, so filters are still set on return. */
export function useSticky(key, initial) {
  const [value, setValue] = useState(() => (sticky.has(key) ? sticky.get(key) : initial));
  useEffect(() => { sticky.set(key, value); }, [key, value]);
  return [value, setValue];
}

export function useDebounced(value, ms = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const WIDE = '(min-width: 1024px)';

export function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | SportsAnalytics` : 'SportsAnalytics: NBA results against the betting lines';
  }, [title]);
}

/* ------------------------------------------------------------------ icons */

const Svg = ({ children, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const Icon = {
  Ball: props => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 2.8v18.4M2.8 12h18.4" />
      <path d="M5.6 5.4c2.3 1.8 3.6 4 3.6 6.6s-1.3 4.8-3.6 6.6M18.4 5.4c-2.3 1.8-3.6 4-3.6 6.6s1.3 4.8 3.6 6.6" />
    </Svg>
  ),
  Back: props => <Svg {...props}><path d="M15 5l-7 7 7 7" /></Svg>,
  Sun: props => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </Svg>
  ),
  Moon: props => <Svg {...props}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Svg>,
  Search: props => <Svg {...props}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Svg>,
  Minus: props => <Svg {...props}><path d="M6 12h12" /></Svg>,
  Plus: props => <Svg {...props}><path d="M12 6v12M6 12h12" /></Svg>,
  GitHub: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  ),
};

/* ------------------------------------------------------- list and detail */

const ListScroll = createContext(null);
const scrollMemory = new Map();

/**
 * A list beside the selected item's details. On wide screens the list has its
 * own scroll and the first item opens by default; on phones the list and the
 * details are separate screens, and going back restores the list's scroll.
 */
export function ListDetail({ name, selected, list, detail }) {
  const wide = useWide();
  const listRef = useRef(null);
  const [scroller, setScroller] = useState(null);
  const { pathname } = useLocation();

  useEffect(() => setScroller(wide ? listRef.current : null), [wide]);

  useLayoutEffect(() => {
    if (wide) {
      window.scrollTo(0, 0);
    } else if (selected) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, scrollMemory.get(name) || 0);
    }
  }, [selected, wide, name]);

  // Remember where the phone list was scrolled before a row is opened.
  useEffect(() => {
    if (wide || selected) return undefined;
    // Opening a row hides the list and shortens the page, and the browser then
    // clamps the scroll position; only record positions while the list shows.
    const save = () => {
      if (listRef.current && listRef.current.offsetParent !== null) scrollMemory.set(name, window.scrollY);
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [wide, selected, name, pathname]);

  return (
    <div className={`split${selected ? ' split--open' : ''}`}>
      <aside className="split__list" ref={listRef}>
        <ListScroll.Provider value={scroller}>{list}</ListScroll.Provider>
      </aside>
      <section className="split__detail">{detail}</section>
    </div>
  );
}

/** Calls onVisible when the end of a list scrolls into view. */
export function LoadMore({ onVisible, loading, error, onRetry, done, count }) {
  const ref = useRef(null);
  const root = useContext(ListScroll);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    if (!ref.current || done) return undefined;
    const io = new IntersectionObserver(
      entries => entries.some(e => e.isIntersecting) && callback.current(),
      { root, rootMargin: '0px 0px 600px 0px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [root, done, count]);

  if (error) {
    return (
      <div className="load-more">
        <span>Couldn't load more.</span>
        <button type="button" className="text-button" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (done) return count > 20 ? <div className="load-more load-more--end">End of list</div> : null;
  return <div ref={ref} className="load-more">{loading ? <span className="dots" aria-label="Loading" /> : null}</div>;
}

/** Back to the list, shown on phones only. Uses history when we came from the list. */
export function BackLink({ to, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromList = location.state && location.state.fromList;
  return (
    <Link
      to={to}
      className="back-link"
      onClick={e => {
        if (fromList) {
          e.preventDefault();
          navigate(-1);
        }
      }}
    >
      <Icon.Back size={16} />
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------ states */

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${88 - ((i * 23) % 40)}%` }} />)}
    </div>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="detail-loading" role="status" aria-label={label}>
      <span className="skeleton-block skeleton-block--title" />
      <span className="skeleton-block skeleton-block--hero" />
      <Skeleton lines={5} />
    </div>
  );
}

export function Problem({ error, onRetry, what = 'this' }) {
  return (
    <div className="problem" role="alert">
      <p>Couldn't load {what}. {error && error.message}</p>
      {onRetry && <button type="button" className="button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------- inputs */

export function SearchField({ value, onChange, label, placeholder, list }) {
  return (
    <label className="search-field">
      <span className="visually-hidden">{label}</span>
      <Icon.Search size={16} />
      <input type="search" value={value} placeholder={placeholder} list={list}
        onChange={e => onChange(e.target.value)} autoComplete="off" spellCheck="false" />
    </label>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={o.value === value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A whole-number input with − and + buttons. */
export function Stepper({ value, onChange, min, max, step = 1, label }) {
  const labelId = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = n => Math.min(max, Math.max(min, n));
  const commit = raw => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) setText(String(value));
    else onChange(clamp(n));
  };
  return (
    <div className="stepper">
      <span className="stepper__label" id={labelId}>{label}</span>
      <div className="stepper__control">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}><Icon.Minus size={14} /></button>
        <input inputMode="numeric" aria-labelledby={labelId} value={text}
          onChange={e => setText(e.target.value.replace(/\D/g, ''))}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commit(e.currentTarget.value)} />
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}><Icon.Plus size={14} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------ against-the-line graphics */

/**
 * A number line with the betting line and the final result on it. The gap
 * between them is who beat the line, and by how much.
 *   domain: [min, max] of the axis
 *   line / result: positions on the axis
 *   ends: labels for the two ends of the axis
 */
export function LineStrip({ domain, line, result, ends, lineLabel, resultLabel, zero }) {
  const [lo, hi] = domain;
  const at = x => ((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100;
  const a = at(line);
  const b = at(result);
  const left = Math.min(a, b);
  const width = Math.abs(a - b);
  const resultRight = b >= a;
  return (
    <figure className="strip">
      <div className="strip__track">
        {zero != null && <span className="strip__zero" style={{ left: `${at(zero)}%` }} />}
        <span className={`strip__gap${resultRight ? '' : ' strip__gap--left'}`}
          style={{ left: `${left}%`, width: `${width}%` }} />
        <span className="strip__mark strip__mark--line" style={{ left: `${a}%` }}>
          <span className={`strip__label strip__label--above${a > 82 ? ' is-end' : a < 18 ? ' is-start' : ''}`}>{lineLabel}</span>
        </span>
        <span className="strip__mark strip__mark--result" style={{ left: `${b}%` }}>
          <span className={`strip__label strip__label--below${b > 82 ? ' is-end' : b < 18 ? ' is-start' : ''}`}>{resultLabel}</span>
        </span>
      </div>
      <figcaption className="strip__ends">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </figcaption>
    </figure>
  );
}

/**
 * A value and its 95% interval on a zoomed scale, with reference lines (such as
 * the 52.4% break-even). The dot is orange when the value beat the first
 * reference. The same numbers are always in the text beside it.
 *   domain: [min, max]; refs: [{ at, label }]; format: value -> text
 */
export function IntervalScale({ value, low, high, domain, refs = [], format, ticks, label }) {
  const [lo, hi] = domain;
  const at = x => ((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100;
  const beat = refs[0] && value > refs[0].at;
  const edge = x => (x > 85 ? ' is-end' : x < 15 ? ' is-start' : '');
  return (
    <figure className="interval" role="img" aria-label={label}>
      <div className="interval__plot">
        {ticks.map(t => (
          <span key={t} className="interval__tick" style={{ left: `${at(t)}%` }}>
            <span className={`interval__tick-label${edge(at(t))}`}>{format(t)}</span>
          </span>
        ))}
        {refs.map((r, i) => (
          <span key={r.label} className={`interval__ref${i ? ' interval__ref--quiet' : ''}`} style={{ left: `${at(r.at)}%` }}>
            {i === 0 && <span className={`interval__ref-label${edge(at(r.at))}`}>{r.label}</span>}
          </span>
        ))}
        {low != null && (
          <span className="interval__range" style={{ left: `${at(low)}%`, width: `${at(high) - at(low)}%` }} />
        )}
        <span className={`interval__dot${beat ? ' is-beat' : ''}`} style={{ left: `${at(value)}%` }}
          title={low != null ? `${format(value)} (95% interval ${format(low)} to ${format(high)})` : format(value)} />
      </div>
    </figure>
  );
}

/** Ticks every `step` across a domain. */
export const ticksFor = ([lo, hi], step) => {
  const out = [];
  for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) out.push(Number(t.toFixed(6)));
  return out;
};

/** A labelled figure, e.g. "26.8" over "Points". */
export function Figure({ value, label, size = 'md', tone }) {
  return (
    <div className={`figure figure--${size}${tone ? ` figure--${tone}` : ''}`}>
      <span className="figure__value">{value}</span>
      <span className="figure__label">{label}</span>
    </div>
  );
}
