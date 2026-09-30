import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { prefetch, useData, usePaged } from '../api';
import {
  dec, half, int, longDate, minutes, money, odds, pct, plusMinus, season, shortDate, spread,
} from '../format';
import {
  BackLink, Empty, LineStrip, ListDetail, LoadMore, Loading, Problem, SearchField, Segmented,
  Skeleton, useDebounced, useSticky, useTitle, useWide,
} from '../ui';

const SEASONS = Array.from({ length: 12 }, (_, i) => 2006 + i);
const avg = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Who covered, from the home team's side: >0 home, <0 away, 0 push. */
const coverMargin = (homePts, awayPts, homeLine) => homePts - awayPts + homeLine;

/* ----------------------------------------------------------------- list */

export default function Games() {
  const { id } = useParams();
  const wide = useWide();
  const [home, setHome] = useSticky('games.home', '');
  const [away, setAway] = useSticky('games.away', '');
  const [from, setFrom] = useSticky('games.from', '');
  const [to, setTo] = useSticky('games.to', '');
  const [minTotal, setMinTotal] = useSticky('games.min', '');
  const teams = useData('/team/search');

  const filters = {
    'name-or-abbreviation1': useDebounced(home.trim()),
    'name-or-abbreviation2': useDebounced(away.trim()),
    'min-year': from,
    'max-year': to,
    'min-pts': useDebounced(minTotal),
  };
  const list = usePaged('/game/search', filters);
  const filtered = home || away || from || to || minTotal;
  const open = id || (wide && list.rows[0] ? String(list.rows[0].game_id) : null);

  const clear = () => { setHome(''); setAway(''); setFrom(''); setTo(''); setMinTotal(''); };

  return (
    <ListDetail
      name="games"
      selected={id}
      list={
        <>
          <div className="list-head">
            <h1 className="visually-hidden">Games</h1>
            <p className="list-intro">
              14,906 games from 2006–07 to 2017–18, with lines from 10 sportsbooks.
              <span className="legend"><i className="dot" />covered the spread</span>
            </p>
            <div className="filters">
              <div className="filters__pair">
                <SearchField value={home} onChange={setHome} label="Home team" placeholder="Home team" list="team-names" />
                <SearchField value={away} onChange={setAway} label="Away team" placeholder="Away team" list="team-names" />
              </div>
              <div className="filters__row">
                <label className="field">
                  <span>From</span>
                  <select value={from} onChange={e => setFrom(e.target.value)}>
                    <option value="">2006–07</option>
                    {SEASONS.slice(1).map(y => <option key={y} value={y} disabled={to !== '' && y > Number(to)}>{season(y)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>To</span>
                  <select value={to} onChange={e => setTo(e.target.value)}>
                    <option value="">2017–18</option>
                    {SEASONS.slice(0, -1).reverse().map(y => <option key={y} value={y} disabled={from !== '' && y < Number(from)}>{season(y)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Min total</span>
                  <input inputMode="numeric" placeholder="Any" value={minTotal}
                    onChange={e => setMinTotal(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                </label>
              </div>
              {filtered && <button type="button" className="text-button" onClick={clear}>Clear filters</button>}
            </div>
            <datalist id="team-names">
              {(teams.data || []).map(t => <option key={t.team_id} value={t.name} />)}
            </datalist>
          </div>
          <GameList list={list} open={open} filtered={filtered} onClear={clear} />
        </>
      }
      detail={open ? <GameDetail id={open} /> : wide && list.loading ? <Loading /> : null}
    />
  );
}

function GameList({ list, open, filtered, onClear }) {
  if (list.error && list.rows.length === 0) return <Problem error={list.error} onRetry={list.retry} what="games" />;
  if (!list.stale && !list.loading && list.rows.length === 0) {
    return (
      <Empty action={filtered && <button type="button" className="button" onClick={onClear}>Clear filters</button>}>
        No games match these filters.
      </Empty>
    );
  }
  if (list.rows.length === 0) return <Skeleton lines={8} className="skeleton--list" />;
  return (
    <>
      <ol className={`rows${list.stale ? ' is-stale' : ''}`}>
        {list.rows.map(g => <GameRow key={g.game_id} game={g} active={String(g.game_id) === open} />)}
      </ol>
      <LoadMore onVisible={list.loadMore} loading={list.loading} error={list.error && list.rows.length > 0}
        onRetry={list.retry} done={list.done} count={list.rows.length} />
    </>
  );
}

function GameRow({ game: g, active }) {
  const homeLine = g.home_spread == null ? null : half(g.home_spread);
  const cover = homeLine == null ? null : coverMargin(g.home_team_pts, g.away_team_pts, homeLine);
  const favourite =
    homeLine == null ? '' : homeLine === 0 ? 'Pick' : homeLine < 0
      ? `${g.home_team_abbreviation} ${spread(homeLine)}`
      : `${g.away_team_abbreviation} ${spread(-homeLine)}`;
  const awayWon = g.away_team_pts > g.home_team_pts;
  return (
    <li>
      <Link to={`/games/${g.game_id}`} state={{ fromList: true }}
        onPointerEnter={() => prefetchGame(g)} onFocus={() => prefetchGame(g)}
        className={`row game-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
        <span className="game-row__meta">
          <span>{shortDate(g.game_date)}</span>
          <span>{favourite}</span>
        </span>
        <TeamLine abbr={g.away_team_abbreviation} name={g.away_team_name} pts={g.away_team_pts}
          won={awayWon} covered={cover != null && cover < 0} />
        <TeamLine abbr={g.home_team_abbreviation} name={g.home_team_name} pts={g.home_team_pts}
          won={!awayWon} covered={cover != null && cover > 0} home />
      </Link>
    </li>
  );
}

function TeamLine({ abbr, name, pts, won, covered, home }) {
  return (
    <span className={`team-line${won ? ' is-winner' : ''}`}>
      <span className="team-line__abbr">{abbr}</span>
      <span className="team-line__name">{home ? <span className="at">at </span> : null}{name}</span>
      <span className="team-line__pts">{pts}</span>
      <span className={`team-line__cover${covered ? ' dot' : ''}`} aria-label={covered ? 'covered the spread' : undefined} />
    </span>
  );
}

/* --------------------------------------------------------------- detail */

/** Head to head is keyed by the two teams, lower team id first. */
const matchupPath = (a, b) => (a < b ? `/matchup/${a}/${b}` : `/matchup/${b}/${a}`);

/** What a game page loads, so a row can start loading it on hover or touch. */
export const prefetchGame = g => prefetch([
  `/game/${g.game_id}`, `/game/${g.game_id}/betting`, `/game/${g.game_id}/players`,
  matchupPath(g.home_team_id, g.away_team_id), `${matchupPath(g.home_team_id, g.away_team_id)}/pairs`,
]);

function GameDetail({ id }) {
  const game = useData(`/game/${id}`);
  const betting = useData(`/game/${id}/betting`);
  const players = useData(`/game/${id}/players`);
  const [home, away] = game.data || [];
  const pair = home ? matchupPath(home.team_id, away.team_id) : null;
  const h2h = useData(pair);
  const pairs = useData(pair && `${pair}/pairs`);
  useTitle(home ? `${away.name} at ${home.name}, ${shortDate(home.game_date)}` : null);

  if (game.error) return <Problem error={game.error} onRetry={game.retry} what="this game" />;
  // The top of the page appears in one go, so nothing jumps as it loads.
  if (game.loading || (home && ((betting.loading && !betting.error) || (players.loading && !players.error)))) return <Loading />;
  if (!home) {
    return <Empty action={<Link className="button" to="/">See all games</Link>}>There's no game with that id.</Empty>;
  }

  return (
    <article className="detail" key={id}>
      <BackLink to="/">Games</BackLink>
      <header className="scoreboard">
        <p className="kicker">
          <span>{longDate(home.game_date)}</span>
          <span>{season(home.season_year)} {home.season_type === 'Playoffs' ? 'playoffs' : 'regular season'}</span>
        </p>
        <ScoreLine team={away} won={away.pts > home.pts} />
        <ScoreLine team={home} won={home.pts > away.pts} home />
      </header>

      {betting.data ? <AgainstTheLine home={home} away={away} lines={betting.data} />
        : <Problem error={betting.error} onRetry={betting.retry} what="the betting lines" />}

      <section className="section">
        <h2>Lines by sportsbook</h2>
        {betting.data && <LinesTable home={home} away={away} lines={betting.data} />}
      </section>

      <section className="section">
        <h2>Box score</h2>
        {players.data ? <BoxScore home={home} away={away} players={players.data} />
          : <Problem error={players.error} onRetry={players.retry} what="the box score" />}
      </section>

      <section className="section section--h2h">
        <h2>Head to head</h2>
        {h2h.data ? <HeadToHead home={home} away={away} rows={h2h.data} />
          : h2h.error ? <Problem error={h2h.error} onRetry={h2h.retry} what="the head to head" /> : <Skeleton lines={7} />}
      </section>

      <section className="section">
        <h2>Player matchups</h2>
        <p className="section__sub">
          Opposing players who met at least three times, by the share of each game's points the two of them scored.
        </p>
        {pairs.data ? <Pairs home={home} away={away} pairs={pairs.data} />
          : pairs.error ? <Problem error={pairs.error} onRetry={pairs.retry} what="the player matchups" /> : <Skeleton lines={8} />}
      </section>
    </article>
  );
}

function ScoreLine({ team, won, home }) {
  return (
    <div className={`score-line${won ? ' is-winner' : ''}`}>
      <Link to={`/teams/${team.team_id}`} className="score-line__team">
        {home && <span className="at">at </span>}{team.name}
        <span className="score-line__abbr">{team.abbreviation}</span>
      </Link>
      <span className="score-line__pts">{team.pts}</span>
    </div>
  );
}

function AgainstTheLine({ home, away, lines }) {
  const homeLine = half(avg(lines.map(l => l.spread2).filter(x => x != null)));
  const totalLine = half(avg(lines.map(l => l.total1).filter(x => x != null)));
  if (homeLine == null || Number.isNaN(homeLine)) return null;

  const margin = home.pts - away.pts;
  const cover = coverMargin(home.pts, away.pts, homeLine);
  const winner = margin > 0 ? home : away;
  const favourite = homeLine < 0 ? `${home.abbreviation} ${spread(homeLine)}`
    : homeLine > 0 ? `${away.abbreviation} ${spread(-homeLine)}` : 'a pick';
  const spreadRange = Math.ceil((Math.max(Math.abs(margin), Math.abs(homeLine)) + 5) / 5) * 5;

  const total = home.pts + away.pts;
  const overBy = total - totalLine;
  const totalRange = Math.ceil((Math.abs(overBy) + 6) / 5) * 5;
  const books = lines.length;

  return (
    <section className="against" aria-label="Against the line">
      <div className="against__item">
        <h2 className="against__headline">
          {cover > 0 ? `${home.name} covered by ${Math.abs(cover)}`
            : cover < 0 ? `${away.name} covered by ${Math.abs(cover)}`
              : 'Push: the margin matched the spread'}
        </h2>
        <p className="against__sub">
          The spread was {favourite}, averaged over {books} sportsbooks. The {winner.name} won by {Math.abs(margin)}.
        </p>
        <LineStrip
          domain={[-spreadRange, spreadRange]}
          line={-homeLine}
          result={margin}
          zero={0}
          lineLabel={`Spread ${homeLine === 0 ? 'pick' : favourite}`}
          resultLabel={`Final ${winner.abbreviation} by ${Math.abs(margin)}`}
          ends={[`${away.abbreviation} by ${spreadRange}`, `${home.abbreviation} by ${spreadRange}`]}
        />
      </div>
      {!Number.isNaN(totalLine) && (
        <div className="against__item">
          <h2 className="against__headline">
            {overBy > 0 ? `Over by ${overBy}` : overBy < 0 ? `Under by ${-overBy}` : 'Push on the total'}
          </h2>
          <p className="against__sub">
            The total was {totalLine}, averaged over {books} sportsbooks. The teams scored {total}.
          </p>
          <LineStrip
            domain={[totalLine - totalRange, totalLine + totalRange]}
            line={totalLine}
            result={total}
            lineLabel={`Total ${totalLine}`}
            resultLabel={`Scored ${total}`}
            ends={[`${totalLine - totalRange}`, `${totalLine + totalRange}`]}
          />
        </div>
      )}
    </section>
  );
}

const Priced = ({ value, price, format = spread }) => (
  <span className="priced"><span>{format(value)}</span><span className="priced__price">{odds(price)}</span></span>
);

function LinesTable({ home, away, lines }) {
  if (lines.length === 0) return <p className="muted">No lines were recorded for this game.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Sportsbook</th>
            <th scope="col" className="num">{away.abbreviation} spread</th>
            <th scope="col" className="num">{home.abbreviation} spread</th>
            <th scope="col" className="num">{away.abbreviation} moneyline</th>
            <th scope="col" className="num">{home.abbreviation} moneyline</th>
            <th scope="col" className="num">Total</th>
            <th scope="col" className="num">Over</th>
            <th scope="col" className="num">Under</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.book_name}>
              <th scope="row">{l.book_name}</th>
              <td className="num"><Priced value={l.spread1} price={l.spread_price1} /></td>
              <td className="num"><Priced value={l.spread2} price={l.spread_price2} /></td>
              <td className="num">{odds(l.moneyline_price1)}</td>
              <td className="num">{odds(l.moneyline_price2)}</td>
              <td className="num">{l.total1 === l.total2 ? l.total1 : `${l.total1} / ${l.total2}`}</td>
              <td className="num">{odds(l.total_price1)}</td>
              <td className="num">{odds(l.total_price2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const shot = (made, att) => `${made}–${att}`;

function BoxScore({ home, away, players }) {
  const [side, setSide] = useState('away');
  const team = side === 'home' ? home : away;
  const roster = players.find(list => list[0] && list[0].team_id === team.team_id) || [];
  return (
    <>
      <Segmented label="Team" value={side} onChange={setSide}
        options={[{ value: 'away', label: away.name }, { value: 'home', label: home.name }]} />
      <div className="table-wrap">
        <table className="table table--box">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col" className="num">Min</th>
              <th scope="col" className="num">Pts</th>
              <th scope="col" className="num">Reb</th>
              <th scope="col" className="num">Ast</th>
              <th scope="col" className="num">Stl</th>
              <th scope="col" className="num">Blk</th>
              <th scope="col" className="num">FG</th>
              <th scope="col" className="num">3P</th>
              <th scope="col" className="num">FT</th>
              <th scope="col" className="num">TO</th>
              <th scope="col" className="num">PF</th>
              <th scope="col" className="num">+/−</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(p => (
              <tr key={p.id} className={p.min == null ? 'is-dnp' : ''}>
                <th scope="row">
                  <Link to={`/players/${p.player_id}`}>{p.display_first_last}</Link>
                  {p.start_position && <span className="position">{p.start_position}</span>}
                </th>
                {p.min == null ? (
                  <td colSpan={12} className="dnp">Did not play</td>
                ) : (
                  <>
                    <td className="num">{minutes(p.min)}</td>
                    <td className="num strong">{p.pts}</td>
                    <td className="num">{p.reb}</td>
                    <td className="num">{p.ast}</td>
                    <td className="num">{p.stl}</td>
                    <td className="num">{p.blk}</td>
                    <td className="num">{shot(p.fgm, p.fga)}</td>
                    <td className="num">{shot(p.fg3m, p.fg3a)}</td>
                    <td className="num">{shot(p.ftm, p.fta)}</td>
                    <td className="num">{p.tov}</td>
                    <td className="num">{p.pf}</td>
                    <td className="num">{plusMinus(p.plus_minus)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{team.name}</th>
              <td className="num" />
              <td className="num strong">{team.pts}</td>
              <td className="num">{team.reb}</td>
              <td className="num">{team.ast}</td>
              <td className="num">{team.stl}</td>
              <td className="num">{team.blk}</td>
              <td className="num">{shot(team.fgm, team.fga)}</td>
              <td className="num">{shot(team.fg3m, team.fg3a)}</td>
              <td className="num">{shot(team.ftm, team.fta)}</td>
              <td className="num">{team.tov}</td>
              <td className="num">{team.pf}</td>
              <td className="num" />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

function HeadToHead({ home, away, rows }) {
  const of = team => rows.find(r => r.team_id === team.team_id);
  const [a, h] = [of(away), of(home)];
  if (!a || !h) return <p className="muted">These teams have no other meetings on record.</p>;
  const lead = a.wins === h.wins ? 'The series is level'
    : `The ${a.wins > h.wins ? away.name : home.name} lead ${Math.max(a.wins, h.wins)}–${Math.min(a.wins, h.wins)}`;
  const pushes = a.pushes ? ` ${a.pushes === 1 ? 'One meeting' : `${a.pushes} meetings`} landed exactly on the spread.` : '';

  const facts = [
    { label: 'Wins', v: t => t.wins, fmt: int, best: true },
    { label: 'Points per game', v: t => t.avg_pts, fmt: x => dec(x), best: true },
    { label: 'Average spread', v: t => t.avg_spread, fmt: x => (x == null ? '–' : spread(Number(x.toFixed(1)))) },
    { label: 'Covered the spread', v: t => t.covers, fmt: int, best: true },
    { label: 'Won as the underdog', v: t => t.underdog_wins, fmt: (x, t) => `${int(x)} of ${int(t.underdog_games)}` },
    { label: '$100 on each underdog game', v: t => t.underdog_money, fmt: money, money: true },
  ];

  return (
    <>
      <p className="section__sub">
        {lead} over {a.total_games} meetings from 2006–07 to 2017–18, with an average total
        of {dec(a.average_total)}.{pushes}
      </p>
      <div className="tape">
        <div className="tape__head">
          <Link to={`/teams/${away.team_id}`}>{away.name}</Link>
          <span />
          <Link to={`/teams/${home.team_id}`}>{home.name}</Link>
        </div>
        {facts.map(f => {
          const [x, y] = [f.v(a), f.v(h)];
          const cls = (mine, theirs) => [
            'tape__value',
            f.best && mine > theirs ? 'is-lead' : '',
            f.money && mine > 0 ? 'is-beat' : '',
          ].filter(Boolean).join(' ');
          return (
            <div className="tape__row" key={f.label}>
              <span className={cls(x, y)}>{f.fmt(x, a)}</span>
              <span className="tape__label">{f.label}</span>
              <span className={cls(y, x)}>{f.fmt(y, h)}</span>
            </div>
          );
        })}
      </div>
      <p className="source-note">Spread and underdog results use 5Dimes lines; the average spread uses every book.</p>
    </>
  );
}

function Pairs({ home, away, pairs }) {
  const [all, setAll] = useState(false);
  // name1 plays for the team with the lower id.
  const first = home.team_id < away.team_id ? home : away;
  const second = first === home ? away : home;
  const shown = useMemo(() => (all ? pairs : pairs.slice(0, 8)), [all, pairs]);
  if (pairs.length === 0) return <p className="muted">No pair of opponents met three times.</p>;
  return (
    <>
      <div className="table-wrap table-wrap--narrow">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{first.name}</th>
              <th scope="col">{second.name}</th>
              <th scope="col" className="num">Games</th>
              <th scope="col" className="num">Share of points</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={`${p.player1_id}-${p.player2_id}`}>
                <td><Link to={`/players/${p.player1_id}`}>{p.name1}</Link></td>
                <td><Link to={`/players/${p.player2_id}`}>{p.name2}</Link></td>
                <td className="num">{p.total_games}</td>
                <td className="num">{pct(p.avg_pct_pts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pairs.length > 8 && (
        <button type="button" className="text-button" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${pairs.length}`}
        </button>
      )}
    </>
  );
}
