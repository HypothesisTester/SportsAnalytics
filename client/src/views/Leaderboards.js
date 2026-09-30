import React from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../api';
import { BREAK_EVEN, cents, int, pct } from '../format';
import { meanInterval, wilson } from '../stats';
import { bound } from './betting';
import { Problem, Skeleton, Stepper, useDebounced, useSticky, useTitle } from '../ui';

export default function Leaderboards() {
  useTitle('Leaderboards');
  return (
    <div className="page page--wide">
      <header className="page__head">
        <h1>Leaderboards</h1>
        <p className="page__intro">
          The players whose teams did best against the bookmakers, and the opponents who shared the scoring most.
          The first two lists are ranked by the bottom of each player's 95% interval, so a short hot streak can't top
          them.
        </p>
      </header>
      <div className="boards">
        <Board
          title="Against the spread"
          about="How often a player's team covered the 5Dimes spread in games he played, not counting pushes."
          chance={r => `${int(r.above_even)} of ${int(r.players)} players have an interval entirely above 50%. If none had a real edge, luck alone would put about ${int(r.players * 0.025)} there.`}
          path="/trivia/spread_players" stickyKey="spread" initial={50} max={1000} step={10}
          render={x => ({
            key: x.person_id,
            name: <Link to={`/players/${x.person_id}`}>{x.display_first_last}</Link>,
            detail: (() => {
              const [lo, hi] = wilson(x.count, x.total_games - x.pushes);
              return `Covered ${int(x.count)} of ${int(x.total_games - x.pushes)}, 95% interval ${pct(lo, 0)}–${pct(hi, 0)}`;
            })(),
            figure: pct(x.spread_percentage),
            beat: x.spread_percentage > BREAK_EVEN,
          })}
        />
        <Board
          title="As the underdog"
          about="Return per game from $100 on a player's team whenever it was the moneyline underdog, over at least 30 games."
          chance={r => `${int(r.above_even)} of ${int(r.players)} players have an interval entirely above $0. With no real edge, luck alone would put at most about ${int(r.players * 0.025)} there.`}
          path="/trivia/underdog_players" stickyKey="underdog" initial={30} min={30} max={517} step={5}
          render={x => ({
            key: x.player_id,
            name: <Link to={`/players/${x.player_id}`}>{x.display_first_last}</Link>,
            detail: (() => {
              const { low, high } = meanInterval(x.total_games, x.total_money, x.money_sum_sq);
              return `Won ${int(x.underdog_wins)} of ${int(x.total_games)}, 95% interval ${bound(low)} to ${bound(high)}`;
            })(),
            figure: cents(x.money_per_game),
            beat: x.money_per_game > 0,
          })}
        />
        <Board
          title="Scoring matchups"
          about="Opposing players who scored the largest share of their games' points between them."
          path="/trivia/top_matchups" stickyKey="matchups" initial={5} max={57} step={1}
          render={x => ({
            key: `${x.name1}-${x.name2}`,
            name: <>{x.name1} <span className="versus">and</span> {x.name2}</>,
            detail: `${int(x.total_games)} games`,
            figure: pct(x.avg_pct_pts),
          })}
        />
      </div>
    </div>
  );
}

function Board({ title, about, chance, path, stickyKey, initial, min = 0, max, step, render }) {
  const [minGames, setMinGames] = useSticky(`boards.${stickyKey}`, initial);
  const minimum = useDebounced(minGames, 300);
  const board = useData(path, { minimum_games: minimum }, { keep: true });
  const rows = board.data ? board.data.map(render) : null;

  return (
    <section className="board">
      <h2>{title}</h2>
      <p className="board__about">{about}</p>
      <Stepper label="Minimum games" value={minGames} onChange={setMinGames} min={min} max={max} step={step} />
      {board.error ? <Problem error={board.error} onRetry={board.retry} what="this leaderboard" />
        : !rows ? <Skeleton lines={10} />
          : rows.length === 0 ? <p className="muted">No one has played that many games.</p> : (
            <ol className={`ranking${minGames !== minimum || board.loading ? ' is-stale' : ''}`}>
              {rows.map((r, i) => (
                <li key={r.key}>
                  <span className="ranking__rank">{i + 1}</span>
                  <span className="ranking__main">
                    <span className="ranking__name">{r.name}</span>
                    <span className="ranking__detail">{r.detail}</span>
                  </span>
                  <span className={`ranking__figure${r.beat ? ' beat' : ''}`}>{r.figure}</span>
                </li>
              ))}
            </ol>
          )}
      {chance && board.data && board.data[0] && <p className="board__note">{chance(board.data[0])}</p>}
    </section>
  );
}
