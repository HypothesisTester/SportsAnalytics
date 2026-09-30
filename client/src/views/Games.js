import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData, usePaged } from '../api';
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
                    {SEASONS.slice(1).map(y => <option key={y} value={y}>{season(y)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>To</span>
                  <select value={to} onChange={e => setTo(e.target.value)}>
                    <option value="">2017–18</option>
                    {SEASONS.slice(0, -1).reverse().map(y => <option key={y} value={y}>{season(y)}</option>)}
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

function GameDetail({ id }) {
  const game = useData(`/game/${id}`);
  const betting = useData(`/game/${id}/betting`);
  const players = useData(`/game/${id}/players`);
  const h2h = useData(`/game/${id}/matchup_stats`);
  const pairs = useData(`/game/${id}/matchup_top_pairs`);

  const [home, away] = game.data || [];
  useTitle(home ? `${away.name} at ${home.name}, ${shortDate(home.game_date)}` : null);

  if (game.error) return <Problem error={game.error} onRetry={game.retry} what="this game" />;
  if (game.loading) return <Loading />;
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
        : betting.error ? <Problem error={betting.error} onRetry={betting.retry} what="the betting lines" />
          : <Skeleton lines={3} />}

      <section className="section">
        <h2>Lines by sportsbook</h2>
        {betting.data ? <LinesTable home={home} away={away} lines={betting.data} /> : <Skeleton lines={6} />}
      </section>

      <section className="section">
        <h2>Box score</h2>
        {players.data ? <BoxScore home={home} away={away} players={players.data} />
          : players.error ? <Problem error={players.error} onRetry={players.retry} what="the box score" />
            : <Skeleton lines={8} />}
      </section>

      <section className="section">
        {h2h.data ? <HeadToHead home={home} away={away} stats={h2h.data[0]} /> : <><h2>Head to head</h2><Skeleton lines={5} /></>}
      </section>

      <section className="section">
        <h2>Player matchups</h2>
        <p className="section__sub">
          Opposing players in these teams' meetings, by the share of each game's points the two of them scored.
        </p>
        {pairs.data ? <Pairs home={home} away={away} pairs={pairs.data} /> : <Skeleton lines={4} />}
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

function HeadToHead({ home, away, stats }) {
  if (!stats) return <><h2>Head to head</h2><p className="muted">These teams have no other meetings on record.</p></>;
  // The query numbers the teams by team id, so map "1" and "2" onto away and home.
  const key = team => (team.team_id < (team === home ? away : home).team_id ? '1' : '2');
  const a = key(away);
  const h = key(home);
  const get = (name, k) => stats[name.replace('#', k)];
  const wins = [get('team#_wins', a), get('team#_wins', h)];
  const lead = wins[0] === wins[1] ? 'The series is level'
    : `The ${wins[0] > wins[1] ? away.name : home.name} lead ${Math.max(...wins)}–${Math.min(...wins)}`;

  const rows = [
    { label: 'Wins', v: wins, fmt: int, best: 'high' },
    { label: 'Points per game', v: [get('avg_pts_team#', a), get('avg_pts_team#', h)], fmt: x => dec(x), best: 'high' },
    { label: 'Average spread', v: [get('avg_spread_team#', a), get('avg_spread_team#', h)], fmt: x => spread(Number(x.toFixed(1))) },
    { label: 'Covered the spread', v: [get('spread_success_team#', a), get('spread_success_team#', h)], fmt: int, best: 'high' },
    { label: 'Wins as the underdog', v: [get('underdog_wins_team#', a), get('underdog_wins_team#', h)], fmt: int, best: 'high' },
    { label: '$100 on every underdog game', v: [get('total_money_team#', a), get('total_money_team#', h)], fmt: money, money: true },
  ];

  return (
    <>
      <h2>Head to head</h2>
      <p className="section__sub">
        {lead} over {stats.total_games} meetings from 2006–07 to 2017–18, with an average total of {dec(stats.average_total)}.
      </p>
      <div className="tape">
        <div className="tape__head">
          <Link to={`/teams/${away.team_id}`}>{away.name}</Link>
          <span />
          <Link to={`/teams/${home.team_id}`}>{home.name}</Link>
        </div>
        {rows.map(r => {
          const lead0 = r.best === 'high' && r.v[0] > r.v[1];
          const lead1 = r.best === 'high' && r.v[1] > r.v[0];
          const tone = x => (r.money ? (x > 0 ? ' is-beat' : '') : '');
          return (
            <div className="tape__row" key={r.label}>
              <span className={`tape__value${lead0 ? ' is-lead' : ''}${tone(r.v[0])}`}>{r.fmt(r.v[0])}</span>
              <span className="tape__label">{r.label}</span>
              <span className={`tape__value${lead1 ? ' is-lead' : ''}${tone(r.v[1])}`}>{r.fmt(r.v[1])}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Pairs({ home, away, pairs }) {
  const [all, setAll] = useState(false);
  // name1 plays for the team with the lower id.
  const first = home.team_id < away.team_id ? home : away;
  const second = first === home ? away : home;
  const shown = useMemo(() => (all ? pairs : pairs.slice(0, 8)), [all, pairs]);
  if (pairs.length === 0) return <p className="muted">No pairs on record.</p>;
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
              <tr key={`${p.name1}-${p.name2}`}>
                <td>{p.name1}</td>
                <td>{p.name2}</td>
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

