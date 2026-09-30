// The strategy tester: pick a betting rule and see what $100 on every matching
// bet from 2006-07 to 2017-18 would have returned, with 95% intervals and a
// verdict on whether the result is more than luck. The rule lives in the URL, so
// a result can be shared.
import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../api';
import { ProfitChart, SeasonTable } from '../charts';
import { cents, int, money, odds, pct, season, signedPct, spread } from '../format';
import { meanInterval, wilson } from '../stats';
import { Figure, IntervalScale, Problem, Segmented, Skeleton, ticksFor, useDebounced } from '../ui';
import { MIN_FOR_INTERVAL } from './betting';

const BOOKS = ['5Dimes', 'BetOnline', 'Bookmaker', 'Bovada', 'Heritage', 'Intertops', 'JustBet', 'Pinnacle Sports',
  'Sportsbetting', 'YouWager'];
const SEASONS = Array.from({ length: 12 }, (_, i) => 2006 + i);

const DEFAULTS = {
  market: 'spread', venue: 'any', role: 'any', side: 'over', min: '', max: '', from: '2006', to: '2017',
  type: 'all', team: '', book: '5Dimes',
};

const PRESETS = [
  { label: 'Home underdogs', rule: { market: 'spread', venue: 'home', role: 'underdog' } },
  { label: 'Big road favourites', rule: { market: 'spread', venue: 'away', role: 'favourite', max: '-7' } },
  { label: 'Long shots to win', rule: { market: 'moneyline', role: 'underdog', min: '300' } },
  { label: 'Heavy favourites to win', rule: { market: 'moneyline', role: 'favourite', max: '-400' } },
  { label: 'Playoff unders', rule: { market: 'total', side: 'under', type: 'playoffs' } },
  { label: 'High totals, over', rule: { market: 'total', side: 'over', min: '215' } },
];

const LINE = {
  spread: { label: 'Spread', hint: "The spread is the team's own: from +7 picks big underdogs." },
  moneyline: { label: 'Odds', hint: "American odds for the team: from +300 picks long shots." },
  total: { label: 'Total', hint: 'From 215 picks high-scoring games.' },
};

/** A typed line limit that is a number ("-", "." and "" are not). */
const isNumber = v => v !== '' && !Number.isNaN(Number(v));

/** The rule in words, for the headline. */
function describe(r, teams) {
  const team = r.team && teams ? (teams.find(t => String(t.team_id) === r.team) || {}).name : null;
  const show = v => {
    const n = Number(v);
    if (Number.isNaN(n)) return v;
    return r.market === 'spread' ? spread(n) : r.market === 'moneyline' ? odds(n) : String(n);
  };
  const hasMin = isNumber(r.min);
  const hasMax = isNumber(r.max);
  const range = hasMin && hasMax ? ` between ${show(r.min)} and ${show(r.max)}`
    : hasMin ? ` of ${show(r.min)} or more` : hasMax ? ` of ${show(r.max)} or less` : '';
  const games = r.type === 'playoffs' ? 'playoff ' : r.type === 'regular' ? 'regular season ' : '';
  if (r.market === 'total') {
    return `the ${r.side} in every ${games}game${team ? ` involving the ${team}` : ''}${range ? ` with a total${range}` : ''}`;
  }
  const who = team ? `the ${team}` : 'every team';
  const where = r.venue === 'home' ? ' at home' : r.venue === 'away' ? ' on the road' : '';
  const role = r.role === 'favourite' ? ' as the favourite' : r.role === 'underdog' ? ' as the underdog' : '';
  const market = r.market === 'spread' ? ' on the spread' : ' to win';
  const line = range ? ` with ${r.market === 'spread' ? 'a spread' : 'odds'}${range}` : '';
  return `${who}${where}${role}${market}${games ? ` in ${games}games` : ''}${line}`;
}

function verdict(roiLow, roiHigh) {
  if (roiLow == null) return `With fewer than ${MIN_FOR_INTERVAL} bets, there are too few to judge.`;
  if (roiLow > 0) return 'The whole interval is above zero: this made money beyond what luck explains.';
  if (roiHigh < 0) return 'The whole interval is below zero: this lost money beyond what luck explains, mostly to the bookmaker’s margin.';
  return 'The interval includes zero, so the result is consistent with luck.';
}

export default function Tester() {
  const [params, setParams] = useSearchParams();
  const rule = useMemo(() => Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, params.get(k) ?? DEFAULTS[k]])), [params]);
  const set = changes => {
    const next = { ...rule, ...changes };
    const out = {};
    Object.entries(next).forEach(([k, v]) => { if (v !== DEFAULTS[k] && v !== '') out[k] = v; });
    setParams(out, { replace: true });
  };
  const applyPreset = p => setParams(p.rule, { replace: true });

  const query = useDebounced(rule, 300);
  const apiParams = {
    market: query.market, from: query.from, to: query.to, type: query.type, team: query.team, book: query.book,
    min: isNumber(query.min) ? query.min : '', max: isNumber(query.max) ? query.max : '',
    ...(query.market === 'total' ? { side: query.side } : { venue: query.venue, role: query.role }),
  };
  const result = useData('/backtest', apiParams, { keep: true });
  const teams = useData('/team/search');
  const stale = result.loading || JSON.stringify(query) !== JSON.stringify(rule);
  const activePreset = PRESETS.find(p => Object.entries({ ...DEFAULTS, ...p.rule }).every(([k, v]) => rule[k] === String(v)));

  return (
    <section className="section section--page tester">
      <h2>Test a strategy</h2>
      <p className="prose">
        Pick a rule and see what $100 on every matching bet would have returned from 2006–07 to 2017–18, and whether
        the result is more than luck.
      </p>

      <div className="presets" role="group" aria-label="Examples">
        {PRESETS.map(p => (
          <button key={p.label} type="button" className={`chip${activePreset === p ? ' is-active' : ''}`}
            aria-pressed={activePreset === p} onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="rule">
        <div className="rule__row">
          <div className="rule__group">
            <span className="rule__label">Bet on</span>
            <Segmented label="Bet on" value={rule.market}
              onChange={v => set({ market: v, min: '', max: '' })}
              options={[{ value: 'spread', label: 'Spread' }, { value: 'moneyline', label: 'Moneyline' }, { value: 'total', label: 'Total' }]} />
          </div>
          {rule.market === 'total' ? (
            <div className="rule__group">
              <span className="rule__label">Side</span>
              <Segmented label="Side" value={rule.side} onChange={v => set({ side: v })}
                options={[{ value: 'over', label: 'Over' }, { value: 'under', label: 'Under' }]} />
            </div>
          ) : (
            <>
              <div className="rule__group">
                <span className="rule__label">Team</span>
                <Segmented label="Home or away" value={rule.venue} onChange={v => set({ venue: v })}
                  options={[{ value: 'any', label: 'Either' }, { value: 'home', label: 'Home' }, { value: 'away', label: 'Away' }]} />
              </div>
              <div className="rule__group">
                <span className="rule__label">As</span>
                <Segmented label="Favourite or underdog" value={rule.role} onChange={v => set({ role: v })}
                  options={[{ value: 'any', label: 'Either' }, { value: 'favourite', label: 'Favourite' }, { value: 'underdog', label: 'Underdog' }]} />
              </div>
            </>
          )}
        </div>
        <div className="rule__row rule__row--fields">
          <label className="field field--line">
            <span>{LINE[rule.market].label} from</span>
            <input inputMode="decimal" placeholder="Any" value={rule.min}
              onChange={e => set({ min: e.target.value.replace(/[^\d.+-]/g, '').slice(0, 6) })} />
          </label>
          <label className="field field--line">
            <span>to</span>
            <input inputMode="decimal" placeholder="Any" value={rule.max}
              onChange={e => set({ max: e.target.value.replace(/[^\d.+-]/g, '').slice(0, 6) })} />
          </label>
          <label className="field">
            <span>Seasons from</span>
            <select value={rule.from} onChange={e => set({ from: e.target.value })}>
              {SEASONS.map(y => <option key={y} value={y} disabled={y > Number(rule.to)}>{season(y)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>to</span>
            <select value={rule.to} onChange={e => set({ to: e.target.value })}>
              {SEASONS.map(y => <option key={y} value={y} disabled={y < Number(rule.from)}>{season(y)}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Games</span>
            <select value={rule.type} onChange={e => set({ type: e.target.value })}>
              <option value="all">All games</option>
              <option value="regular">Regular season</option>
              <option value="playoffs">Playoffs</option>
            </select>
          </label>
          <label className="field">
            <span>{rule.market === 'total' ? 'Games involving' : 'Only this team'}</span>
            <select value={rule.team} onChange={e => set({ team: e.target.value })}>
              <option value="">Any team</option>
              {(teams.data || []).map(t => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sportsbook</span>
            <select value={rule.book} onChange={e => set({ book: e.target.value })}>
              {BOOKS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </div>
        <p className="rule__hint">{LINE[rule.market].hint} Leave either end empty for no limit.</p>
      </div>

      {result.error ? <Problem error={result.error} onRetry={result.retry} what="this strategy" />
        : !result.data ? <Skeleton lines={6} />
          : <Results rows={result.data} rule={query} teams={teams.data} stale={stale} />}
    </section>
  );
}

function Results({ rows, rule, teams, stale }) {
  const t = rows.reduce((a, r) => ({
    bets: a.bets + r.bets, wins: a.wins + Number(r.wins), losses: a.losses + Number(r.losses),
    pushes: a.pushes + Number(r.pushes), profit: a.profit + r.profit, sumSq: a.sumSq + r.sum_sq,
    breakEven: a.breakEven + r.break_even,
  }), { bets: 0, wins: 0, losses: 0, pushes: 0, profit: 0, sumSq: 0, breakEven: 0 });

  if (t.bets === 0) {
    return <div className={`results${stale ? ' is-stale' : ''}`}><p className="muted">No bets match this rule.</p></div>;
  }

  const decided = t.wins + t.losses;
  const winRate = decided ? t.wins / decided : null;
  const [winLow, winHigh] = wilson(t.wins, decided);
  const needed = t.breakEven / t.bets;
  const { mean, low, high } = t.bets >= MIN_FOR_INTERVAL ? meanInterval(t.bets, t.profit, t.sumSq) : { mean: t.profit / t.bets };
  const roi = mean / 100;
  const [roiLow, roiHigh] = low == null ? [null, null] : [low / 100, high / 100];
  const sd = t.bets > 1 ? Math.sqrt(Math.max(t.sumSq - (t.profit * t.profit) / t.bets, 0) / (t.bets - 1)) : 0;
  const reach = Math.max(Math.abs(roiLow ?? roi), Math.abs(roiHigh ?? roi), 0.02) * 1.15;
  const edge = [0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2].find(e => e >= reach) || Math.ceil(reach);
  const domain = [-edge, edge];

  const bySeason = Object.values(rows.reduce((acc, r) => {
    const s = acc[r.season] || (acc[r.season] = { season: r.season, bets: 0, wins: 0, losses: 0, pushes: 0, profit: 0 });
    s.bets += r.bets; s.wins += Number(r.wins); s.losses += Number(r.losses); s.pushes += Number(r.pushes); s.profit += r.profit;
    return acc;
  }, {})).sort((a, b) => a.season - b.season);

  return (
    <div className={`results${stale ? ' is-stale' : ''}`} aria-live="polite">
      <p className="results__lede">
        Betting $100 on {describe(rule, teams)}{' '}
        <span className="nowrap">({rule.from === rule.to ? `the ${season(Number(rule.from))} season` : `${season(Number(rule.from))} to ${season(Number(rule.to))}`}
          {rule.book !== '5Dimes' ? `, ${rule.book} lines` : ''}):</span>
      </p>
      <div className="figures figures--lead">
        <Figure size="lg" value={int(t.bets)} label="Bets" />
        <Figure size="lg" value={winRate == null ? '–' : pct(winRate)} label="Won" />
        <Figure size="lg" value={money(t.profit)} label="Net result" tone={t.profit > 0 ? 'beat' : undefined} />
        <Figure size="lg" value={signedPct(roi)} label="Return per bet"
          tone={roi > 0 ? 'beat' : undefined} />
      </div>
      <p className="results__text">
        {int(t.wins)} won, {int(t.losses)} lost{t.pushes ? `, ${int(t.pushes)} pushed` : ''}; the 95% interval for the win
        rate is {pct(winLow)} to {pct(winHigh)}. The prices imply an average break-even rate of {pct(needed)}, but with
        mixed odds the return per bet, not the win rate, decides the result.
        {roiLow != null && ` The 95% interval for the return per bet is ${signedPct(roiLow)} to ${signedPct(roiHigh)}, or ${cents(low)} to ${cents(high)} per $100.`}
        {' '}{verdict(roiLow, roiHigh)}
      </p>
      {roiLow != null && (
        <IntervalScale value={roi} low={roiLow} high={roiHigh} domain={domain} ticks={ticksFor(domain, edge / 2)}
          format={x => signedPct(x, edge < 0.1 ? 1 : 0)}
          refs={[{ at: 0, label: 'Break-even' }]}
          label={`Return per bet ${signedPct(roi)}, 95% interval ${signedPct(roiLow)} to ${signedPct(roiHigh)}`} />
      )}

      <h3 className="chart-title results__chart-title">Running total</h3>
      <ProfitChart rows={rows} sd={sd} format={money} label={`Running total, ending at ${money(t.profit)} after ${int(t.bets)} bets`} />

      <h3 className="chart-title results__chart-title">By season</h3>
      <SeasonTable rows={bySeason} columns={[
        { label: 'Bets', value: r => int(r.bets) },
        { label: 'Record', value: r => `${r.wins}–${r.losses}${r.pushes ? `–${r.pushes}` : ''}` },
        { label: 'Win rate', value: r => (r.wins + r.losses ? pct(r.wins / (r.wins + r.losses)) : '–') },
        { label: 'Net', value: r => money(r.profit) },
        { label: 'Return per bet', value: r => signedPct(r.profit / (100 * r.bets)) },
      ]} />
    </div>
  );
}
