// The two betting summaries a team and a player both have.
import React from 'react';
import { BREAK_EVEN, cents, int, money, pct } from '../format';
import { CoverBar, Figure, Skeleton } from '../ui';

export function AgainstTheSpread({ data, subject }) {
  if (!data) return <Skeleton lines={3} />;
  const row = data[0];
  if (!row || !row.total_games) return <p className="muted">No spread results on record.</p>;
  const beat = row.spread_percentage > BREAK_EVEN;
  return (
    <div className="ats">
      <Figure size="lg" value={pct(row.spread_percentage)} label="Cover rate" tone={beat ? 'beat' : undefined} />
      <p className="ats__text">
        {subject} covered {int(row.count)} of {int(row.total_games - row.pushes)} spreads
        {row.pushes ? `, not counting ${int(row.pushes)} ${row.pushes === 1 ? 'push' : 'pushes'}` : ''}.
        {beat ? ' That beats the rate needed to profit at standard odds.' : ' That is short of the rate needed to profit at standard odds.'}
      </p>
      <CoverBar rate={row.spread_percentage} />
    </div>
  );
}

/**
 * Underdog record and the return on $100 moneyline bets. Teams and players name
 * the fields differently, so the caller maps them: { games, wins, money, perGame }.
 */
export function AsTheUnderdog({ loading, games, wins, total, perGame, subject }) {
  if (loading) return <Skeleton lines={3} />;
  if (!games) return <p className="muted">No underdog games on record.</p>;
  return (
    <>
      <p className="section__sub">
        {subject} {subject.endsWith('s') ? 'were' : 'was'} the moneyline underdog in {int(games)} games and won {int(wins)} of them.
      </p>
      <div className="figures">
        <Figure value={pct(wins / games)} label="Won as the underdog" />
        <Figure value={money(total)} label="Return on $100 each game" tone={total > 0 ? 'beat' : undefined} />
        <Figure value={cents(perGame)} label="Per game" tone={perGame > 0 ? 'beat' : undefined} />
      </div>
    </>
  );
}

export const SourceNote = () => (
  <p className="source-note">Spread and underdog results use 5Dimes lines from 2006–07 to 2017–18.</p>
);
