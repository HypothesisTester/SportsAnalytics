import React from 'react';
import { Link } from 'react-router-dom';
import { useData, usePaged } from '../api';
import { int, money, odds, pct, shortDate, spread } from '../format';
import { Figure, LoadMore, Problem, Skeleton, useDebounced, useSticky, useTitle } from '../ui';

export default function Strategies() {
  useTitle('Strategies');
  return (
    <div className="page">
      <header className="page__head">
        <h1>Strategies</h1>
        <p className="page__intro">
          Two ways to exploit sportsbooks disagreeing about the same game, tested on every game from 2006–07 to 2017–18.
        </p>
      </header>
      <Middling />
      <Arbitrage />
    </div>
  );
}

function Middling() {
  const [gap, setGap] = useSticky('strategies.gap', 2);
  const threshold = useDebounced(gap, 350);
  const totals = useData('/trivia/middling_total', { threshold }, { keep: true });
  const spreads = useData('/trivia/middling_spread', { threshold }, { keep: true });
  const settling = gap !== threshold || totals.loading || spreads.loading;

  return (
    <section className="section section--page">
      <h2>Middling</h2>
      <p className="prose">
        When two books set different lines on a game, bet the over at the lower total and the under at the higher one.
        If the final score lands between the two lines, both bets win. Otherwise one wins and one loses, and you give up
        only the bookmaker's margin. The same works with two different spreads.
      </p>
      <label className="range">
        <span className="range__label">
          Lines at least <strong>{gap} {gap === 1 ? 'point' : 'points'}</strong> apart
        </span>
        <input type="range" min="0.5" max="10" step="0.5" value={gap}
          onChange={e => setGap(Number(e.target.value))} aria-valuetext={`${gap} points`} />
      </label>
      <div className={`middles${settling ? ' is-stale' : ''}`}>
        <MiddleResult title="Totals" result={totals} />
        <MiddleResult title="Spreads" result={spreads} />
      </div>
    </section>
  );
}

function MiddleResult({ title, result }) {
  if (result.error) return <Problem error={result.error} onRetry={result.retry} what={title.toLowerCase()} />;
  const r = result.data && result.data[0];
  if (!r) return <div className="middle"><h3>{title}</h3><Skeleton lines={3} /></div>;
  const pairs = r.middles_total_won + r.middles_total_lost;
  if (!pairs) return <div className="middle"><h3>{title}</h3><p className="muted">No pairs of lines that far apart.</p></div>;
  return (
    <div className="middle">
      <h3>{title}</h3>
      <div className="figures">
        <Figure size="lg" value={pct(r.middles_total_won / pairs)} label="Middles that hit" />
        <Figure size="lg" value={money(r.middle_total_money)} label="Net result" tone={r.middle_total_money > 0 ? 'beat' : undefined} />
      </div>
      <p className="middle__text">
        {int(r.middles_total_won)} of {int(pairs)} pairs of lines hit, betting $100 on each side.
      </p>
    </div>
  );
}

function Arbitrage() {
  const list = usePaged('/trivia/arbitrage', {});
  return (
    <section className="section section--page">
      <h2>Arbitrage</h2>
      <p className="prose">
        Sometimes two books offer the same spread and price opposite sides of it generously enough that betting both
        guarantees a profit: the implied probabilities of the two prices add up to less than 100%. The further below
        100%, the bigger the guaranteed return, before you size the two stakes to match. These are the best cases, largest
        return first.
      </p>
      {list.error && list.rows.length === 0 ? <Problem error={list.error} onRetry={list.retry} what="arbitrage opportunities" />
        : list.rows.length === 0 ? <Skeleton lines={8} /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Game</th>
                    <th scope="col">Away bet</th>
                    <th scope="col">Home bet</th>
                    <th scope="col" className="num">Implied total</th>
                    <th scope="col" className="num">Guaranteed return</th>
                  </tr>
                </thead>
                <tbody>
                  {list.rows.map(x => (
                    <tr key={`${x.game_id}-${x.book1}-${x.book2}`}>
                      <th scope="row">
                        <Link to={`/games/${x.game_id}`} className="cell-main">{x.away} at {x.home}</Link>
                        <span className="cell-sub">{shortDate(x.game_date)}</span>
                      </th>
                      <td>
                        <span className="cell-main">{x.away} {spread(x.away_spread)} at {odds(x.spread_price1)}</span>
                        <span className="cell-sub">{x.book1}</span>
                      </td>
                      <td>
                        <span className="cell-main">{x.home} {spread(-x.away_spread)} at {odds(x.spread_price2)}</span>
                        <span className="cell-sub">{x.book2}</span>
                      </td>
                      <td className="num">{pct(x.arbitrage_percentage)}</td>
                      <td className="num beat">+{pct(1 / x.arbitrage_percentage - 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore onVisible={list.loadMore} loading={list.loading} error={list.error && list.rows.length > 0}
              onRetry={list.retry} done={list.done} count={list.rows.length} />
          </>
        )}
    </section>
  );
}
