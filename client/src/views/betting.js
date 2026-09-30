// The betting summaries a team and a player both have: how often they covered
// the spread and what backing them as the underdog returned, each with a 95%
// interval and a plain verdict on whether the result could be luck.
import React from 'react';
import { BREAK_EVEN, cents, int, money, pct } from '../format';
import { meanInterval, wilson } from '../stats';
import { Figure, IntervalScale, Skeleton, ticksFor } from '../ui';

const round5 = (x, dir) => (dir < 0 ? Math.floor(x * 20) / 20 : Math.ceil(x * 20) / 20);

/** An axis around a rate and its interval: at least 40%–65%, in steps of 5%. */
export const rateDomain = (low, high) => [
  Math.max(0, Math.min(0.4, round5(low - 0.02, -1))),
  Math.min(1, Math.max(0.65, round5(high + 0.02, 1))),
];

export function rateVerdict(low, high) {
  if (low > BREAK_EVEN) return `The whole range is above the ${pct(BREAK_EVEN)} needed to profit, so this is unlikely to be luck.`;
  if (high < 1 - BREAK_EVEN) {
    return `The whole range is below ${pct(1 - BREAK_EVEN)}, so betting the other way would have profited, and that is unlikely to be luck.`;
  }
  if (high < BREAK_EVEN) {
    return `The whole range is below the ${pct(BREAK_EVEN)} needed to profit, so backing them lost money beyond what luck explains; betting against them wouldn't clearly have paid either.`;
  }
  return `The range includes the ${pct(BREAK_EVEN)} needed to profit, so the record is consistent with luck.`;
}

/** Below this many games a t interval on returns (mostly -$100 or the price) isn't trustworthy. */
export const MIN_FOR_INTERVAL = 30;

export function returnVerdict(low, high) {
  if (low == null) return `With fewer than ${MIN_FOR_INTERVAL} games, there are too few to say whether this is luck.`;
  if (low > 0) return 'The whole range is above zero, so the profit is unlikely to be luck.';
  if (high < 0) return 'The whole range is below zero, so the loss is more than luck explains.';
  return 'The range includes zero, so the result is consistent with luck.';
}

export function AgainstTheSpread({ data, subject }) {
  if (!data) return <Skeleton lines={3} />;
  const row = data[0];
  const decided = row ? row.total_games - row.pushes : 0;
  if (!row || !decided) return <p className="muted">No spread results on record.</p>;
  const rate = row.count / decided;
  const [low, high] = wilson(row.count, decided);
  const domain = rateDomain(low, high);
  return (
    <div className="ats">
      <Figure size="lg" value={pct(rate)} label="Cover rate" tone={rate > BREAK_EVEN ? 'beat' : undefined} />
      <p className="ats__text">
        {subject} covered {int(row.count)} of {int(decided)} spreads
        {row.pushes ? `, not counting ${int(row.pushes)} ${row.pushes === 1 ? 'push' : 'pushes'}` : ''}.
        {' '}Allowing for luck, the 95% interval for the underlying rate is {pct(low)} to {pct(high)}.
        {' '}{rateVerdict(low, high)}
      </p>
      <IntervalScale value={rate} low={low} high={high} domain={domain} ticks={ticksFor(domain, 0.05)}
        format={x => pct(x, x === Math.round(x * 100) / 100 ? 0 : 1)}
        refs={[{ at: BREAK_EVEN, label: `Break-even ${pct(BREAK_EVEN)}` }, { at: 0.5, label: '50%' }]}
        label={`Cover rate ${pct(rate)}, 95% interval ${pct(low)} to ${pct(high)}; break-even is ${pct(BREAK_EVEN)}`} />
    </div>
  );
}

const NICE = [10, 20, 40, 50, 100, 200, 300, 400, 500, 1000];

/** A symmetric dollar axis around zero that holds the interval, with five ticks. */
const moneyDomain = (low, high) => {
  const reach = Math.max(Math.abs(low), Math.abs(high)) * 1.1;
  const edge = NICE.find(n => n >= reach) || Math.ceil(reach / 500) * 500;
  return { domain: [-edge, edge], step: edge / 2 };
};

/** Whole dollars, or cents when a bound is close to zero (so +$0.41 isn't shown as $0). */
export const bound = x => (Math.abs(x) < 10 ? cents(x) : money(x));

/**
 * Underdog record and the return on $100 moneyline bets. Teams and players name
 * the fields differently, so the caller maps them.
 */
export function AsTheUnderdog({ loading, games, wins, total, sumSq, subject }) {
  if (loading) return <Skeleton lines={3} />;
  if (!games) return <p className="muted">No underdog games on record.</p>;
  const { mean, low, high } = games >= MIN_FOR_INTERVAL ? meanInterval(games, total, sumSq) : { mean: total / games };
  const scale = low != null ? moneyDomain(low, high) : null;
  return (
    <>
      <p className="section__sub">
        {subject} {subject.endsWith('s') ? 'were' : 'was'} the moneyline underdog in {int(games)} games and won {int(wins)} of
        them. Betting $100 each time returned {money(total)}, or {cents(mean)} a game
        {low != null ? `; the 95% interval for the return per game is ${bound(low)} to ${bound(high)}` : ''}.
        {' '}{returnVerdict(low, high)}
      </p>
      <div className="figures">
        <Figure value={pct(wins / games)} label="Won as the underdog" />
        <Figure value={money(total)} label="Return on $100 each game" tone={total > 0 ? 'beat' : undefined} />
        <Figure value={cents(mean)} label="Per game" tone={mean > 0 ? 'beat' : undefined} />
      </div>
      {scale && (
        <IntervalScale value={mean} low={low} high={high} domain={scale.domain} ticks={ticksFor(scale.domain, scale.step)}
          format={x => money(x)} refs={[{ at: 0, label: 'Break-even $0' }]}
          label={`Return per game ${cents(mean)}, 95% interval ${cents(low)} to ${cents(high)}`} />
      )}
    </>
  );
}

export const SourceNote = () => (
  <p className="source-note">
    Spread and underdog results use 5Dimes lines from 2006–07 to 2017–18, without preseason games. Intervals are 95%:
    Wilson for rates, t for returns (approximate). They describe one team or player on its own: picked as the best of
    many, a result is more likely than that to be luck.
  </p>
);
