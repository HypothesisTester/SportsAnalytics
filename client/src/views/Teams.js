import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { prefetch, useData } from '../api';
import { dec, int, odds, pct, spread } from '../format';
import {
  BackLink, Empty, Figure, ListDetail, Loading, Problem, SearchField, Skeleton, useSticky, useTitle, useWide,
} from '../ui';
import { AgainstTheSpread, AsTheUnderdog, SourceNote } from './betting';
import { TeamSeasons } from './seasons';

export default function Teams() {
  const { id } = useParams();
  const wide = useWide();
  const [query, setQuery] = useSticky('teams.query', '');
  const teams = useData('/team/search');
  const q = query.trim().toLowerCase();
  const rows = (teams.data || []).filter(
    t => !q || t.name.toLowerCase().includes(q) || t.abbreviation.toLowerCase().includes(q),
  );
  const open = id || (wide && teams.data && teams.data[0] ? String(teams.data[0].team_id) : null);

  return (
    <ListDetail
      name="teams"
      selected={id}
      list={
        <>
          <div className="list-head">
            <h1 className="visually-hidden">Teams</h1>
            <p className="list-intro">All 30 teams, with results and lines from 2006–07 to 2017–18.</p>
            <SearchField value={query} onChange={setQuery} label="Search teams" placeholder="Search teams" />
          </div>
          {teams.error ? <Problem error={teams.error} onRetry={teams.retry} what="teams" />
            : !teams.data ? <Skeleton lines={8} className="skeleton--list" />
              : rows.length === 0 ? <Empty>No team matches "{query}".</Empty>
                : (
                  <ol className="rows">
                    {rows.map(t => {
                      const active = String(t.team_id) === open;
                      return (
                        <li key={t.team_id}>
                          <Link to={`/teams/${t.team_id}`} state={{ fromList: true }}
                            onPointerEnter={() => prefetch(teamPaths(t.team_id))} onFocus={() => prefetch(teamPaths(t.team_id))}
                            className={`row team-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                            <span className="team-row__abbr">{t.abbreviation}</span>
                            <span className="team-row__name">{t.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                )}
        </>
      }
      detail={open ? <TeamDetail id={open} /> : null}
    />
  );
}

const teamPaths = id => [
  `/team/${id}`, `/team/${id}/top_players?num_players=15`, `/team/${id}/betting`,
  `/team/${id}/spread_cover`, `/team/${id}/underdog_wins`, `/team/${id}/underdog_money`, `/team/${id}/seasons`,
];

function TeamDetail({ id }) {
  const team = useData(`/team/${id}`);
  const players = useData(`/team/${id}/top_players?num_players=15`);
  const books = useData(`/team/${id}/betting`);
  const cover = useData(`/team/${id}/spread_cover`);
  const dogWins = useData(`/team/${id}/underdog_wins`);
  const dogMoney = useData(`/team/${id}/underdog_money`);
  const seasons = useData(`/team/${id}/seasons`);
  const t = team.data && team.data[0];
  useTitle(t ? t.name : null);

  if (team.error) return <Problem error={team.error} onRetry={team.retry} what="this team" />;
  if ([team, players, books, cover, dogWins, dogMoney, seasons].some(r => r.loading)) return <Loading />;
  if (!t) return <Empty action={<Link className="button" to="/teams">See all teams</Link>}>There's no team with that id.</Empty>;

  const games = t.number_wins + t.number_losses;
  const w = dogWins.data && dogWins.data[0];
  const m = dogMoney.data && dogMoney.data[0];

  return (
    <article className="detail" key={id}>
      <BackLink to="/teams">Teams</BackLink>
      <header className="profile">
        <h1 className="profile__name">{t.name}<span className="profile__abbr">{t.abbreviation}</span></h1>
        <div className="figures figures--profile">
          <Figure size="lg" value={`${t.number_wins}–${t.number_losses}`} label={`Record over ${int(games)} games`} />
          <Figure size="lg" value={pct(t.number_wins / games)} label="Win rate" />
          <Figure value={dec(t.avg_points)} label="Points per game" />
          <Figure value={dec(t.avg_rebounds)} label="Rebounds" />
          <Figure value={dec(t.avg_assists)} label="Assists" />
        </div>
      </header>

      <section className="section">
        <h2>Against the spread</h2>
        <AgainstTheSpread data={cover.data} subject={`The ${t.name}`} />
      </section>

      <section className="section">
        <h2>As the underdog</h2>
        <AsTheUnderdog loading={!dogWins.data || !dogMoney.data} subject={`The ${t.name}`}
          games={w && w.total_games} wins={w && w.count} total={m && m.money} sumSq={m && m.money_sum_sq} />
        <SourceNote />
      </section>

      <section className="section">
        <h2>By season</h2>
        <TeamSeasons data={seasons.data} name={t.name} />
      </section>

      <section className="section">
        <h2>Average lines by sportsbook</h2>
        <p className="section__sub">What each book typically offered on the {t.name}.</p>
        {!books.data ? <Skeleton lines={6} /> : (
          <div className="table-wrap table-wrap--narrow">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Sportsbook</th>
                  <th scope="col" className="num">Moneyline</th>
                  <th scope="col" className="num">Spread</th>
                  <th scope="col" className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {books.data.map(b => (
                  <tr key={b.book_name}>
                    <th scope="row">{b.book_name}</th>
                    <td className="num">{odds(b.avg_moneyline_price)}</td>
                    <td className="num">{spread(Number(b.avg_spread.toFixed(1)))}</td>
                    <td className="num">{dec(b.avg_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Top players</h2>
        <p className="section__sub">Averages while playing for the {t.name}, ranked by points, rebounds and assists combined.</p>
        {!players.data ? <Skeleton lines={8} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col" className="num">Pts</th>
                  <th scope="col" className="num">Reb</th>
                  <th scope="col" className="num">Ast</th>
                  <th scope="col" className="num">Stl</th>
                  <th scope="col" className="num">Blk</th>
                  <th scope="col" className="num">Min</th>
                </tr>
              </thead>
              <tbody>
                {players.data.map(p => (
                  <tr key={p.player_id}>
                    <th scope="row"><Link to={`/players/${p.player_id}`}>{p.display_first_last}</Link></th>
                    <td className="num strong">{dec(p.avg_pts)}</td>
                    <td className="num">{dec(p.avg_reb)}</td>
                    <td className="num">{dec(p.avg_ast)}</td>
                    <td className="num">{dec(p.avg_stl)}</td>
                    <td className="num">{dec(p.avg_blk)}</td>
                    <td className="num">{dec(p.avg_min)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
