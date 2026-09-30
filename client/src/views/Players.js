import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { prefetch, useData, usePaged } from '../api';
import { dec, height, int, minutes, pct, plusMinus, season } from '../format';
import {
  BackLink, Empty, Figure, ListDetail, LoadMore, Loading, Problem, SearchField, Skeleton,
  useDebounced, useSticky, useTitle, useWide,
} from '../ui';
import { AgainstTheSpread, AsTheUnderdog, SourceNote } from './betting';
import { PlayerSeasons } from './seasons';

export default function Players() {
  const { id } = useParams();
  const wide = useWide();
  const [name, setName] = useSticky('players.name', '');
  const list = usePaged('/player/search', { name: useDebounced(name.trim()) });
  const open = id || (wide && list.rows[0] ? String(list.rows[0].person_id) : null);

  return (
    <ListDetail
      name="players"
      selected={id}
      list={
        <>
          <div className="list-head">
            <h1 className="visually-hidden">Players</h1>
            <p className="list-intro">Career averages from box scores between 2003–04 and 2022–23. Points per game on the right.</p>
            <SearchField value={name} onChange={setName} label="Search players" placeholder="Search players" />
          </div>
          {list.error && list.rows.length === 0 ? <Problem error={list.error} onRetry={list.retry} what="players" />
            : !list.stale && !list.loading && list.rows.length === 0 ? <Empty>No players match "{name}".</Empty>
              : list.rows.length === 0 ? <Skeleton lines={8} className="skeleton--list" />
                : (
                  <>
                    <ol className={`rows${list.stale ? ' is-stale' : ''}`}>
                      {list.rows.map(p => {
                        const active = String(p.person_id) === open;
                        return (
                          <li key={p.person_id}>
                            <Link to={`/players/${p.person_id}`} state={{ fromList: true }}
                              onPointerEnter={() => prefetch(playerPaths(p.person_id))} onFocus={() => prefetch(playerPaths(p.person_id))}
                              className={`row simple-row${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                              <span className="simple-row__main">
                                <span className="simple-row__title">{p.display_first_last}</span>
                                <span className="simple-row__meta">
                                  {[height(p.height_feet, p.height_inches), p.weight && `${p.weight} lb`].filter(Boolean).join(', ')}
                                </span>
                              </span>
                              <span className="simple-row__figure">{dec(p.pts)}<span> pts</span></span>
                            </Link>
                          </li>
                        );
                      })}
                    </ol>
                    <LoadMore onVisible={list.loadMore} loading={list.loading} error={list.error && list.rows.length > 0}
                      onRetry={list.retry} done={list.done} count={list.rows.length} />
                  </>
                )}
        </>
      }
      detail={open ? <PlayerDetail id={open} /> : wide && list.loading ? <Loading /> : null}
    />
  );
}

const playerPaths = id => [
  `/player/${id}`, `/player/${id}/average_stats`, `/player/${id}/spread_performance`, `/player/${id}/player_underdog`,
  `/player/${id}/seasons`,
];

function PlayerDetail({ id }) {
  const info = useData(`/player/${id}`);
  const avgs = useData(`/player/${id}/average_stats`);
  const spread = useData(`/player/${id}/spread_performance`);
  const underdog = useData(`/player/${id}/player_underdog`);
  const seasons = useData(`/player/${id}/seasons`);
  const p = info.data && info.data[0];
  useTitle(p ? p.display_first_last : null);

  if (info.error) return <Problem error={info.error} onRetry={info.retry} what="this player" />;
  // Show the page once everything has arrived (each part is quick), so nothing jumps.
  if ([info, avgs, spread, underdog, seasons].some(r => r.loading)) return <Loading />;
  if (!p) return <Empty action={<Link className="button" to="/players">See all players</Link>}>There's no player with that id.</Empty>;

  const facts = [
    ['Height', height(p.height_feet, p.height_inches)],
    ['Weight', p.weight && `${p.weight} lb`],
    ['Career', p.from_year && p.to_year && `${p.from_year}–${p.to_year}`],
    ['Drafted', p.draft_year],
    ['Number', p.jersey],
    ['School', p.school],
    ['Country', p.country],
  ].filter(([, v]) => v);

  const a = avgs.data && avgs.data[0];
  const u = underdog.data && underdog.data[0];

  return (
    <article className="detail" key={id}>
      <BackLink to="/players">Players</BackLink>
      <header className="profile">
        <h1 className="profile__name">{p.display_first_last}</h1>
        <dl className="facts">
          {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </header>

      <section className="section">
        <h2>Career averages</h2>
        {!a ? <Skeleton lines={4} /> : !a.games_played ? <p className="muted">No box scores on record.</p> : (
          <>
            <p className="section__sub">
              Per game, over {int(a.games_played)} games
              {seasons.data && seasons.data.length
                ? ` from ${season(seasons.data[0].season_year)} to ${season(seasons.data[seasons.data.length - 1].season_year)}`
                : ''}, not counting preseason.
            </p>
            <div className="figures figures--lead">
              <Figure size="lg" value={dec(a.pts)} label="Points" />
              <Figure size="lg" value={dec(a.reb)} label="Rebounds" />
              <Figure size="lg" value={dec(a.ast)} label="Assists" />
            </div>
            <div className="figures">
              <Figure value={dec(a.stl)} label="Steals" />
              <Figure value={dec(a.blk)} label="Blocks" />
              <Figure value={dec(a.tov)} label="Turnovers" />
              <Figure value={minutes(a.min)} label="Minutes" />
              <Figure value={plusMinus(a.plus_minus, 1)} label="Plus/minus" />
            </div>
            <div className="shooting">
              <Shooting label="Field goals" made={a.fgm} att={a.fga} />
              <Shooting label="Three-pointers" made={a.fg3m} att={a.fg3a} />
              <Shooting label="Free throws" made={a.ftm} att={a.fta} />
            </div>
          </>
        )}
      </section>

      <section className="section">
        <h2>By season</h2>
        <PlayerSeasons data={seasons.data} />
      </section>

      <section className="section">
        <h2>Against the spread</h2>
        <AgainstTheSpread data={spread.data} subject="In games he played, his team" />
      </section>

      <section className="section">
        <h2>As the underdog</h2>
        <AsTheUnderdog loading={!underdog.data} subject="His team" games={u && u.total_games} wins={u && u.underdog_wins}
          total={u && u.total_money} sumSq={u && u.money_sum_sq} />
        <SourceNote />
      </section>
    </article>
  );
}

function Shooting({ label, made, att }) {
  const rate = att ? made / att : null;
  return (
    <div className="shooting__row">
      <span className="shooting__label">{label}</span>
      <span className="shooting__bar" aria-hidden="true"><span style={{ width: `${(rate || 0) * 100}%` }} /></span>
      <span className="shooting__pct">{rate == null ? '–' : pct(rate)}</span>
      <span className="shooting__detail">{dec(made)} of {dec(att)}</span>
    </div>
  );
}
