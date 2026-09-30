// "By season" sections for team and player pages: charts, with the same
// numbers as a table one tap away.
import React from 'react';
import { SeasonColumns, SeasonRates, SeasonTable } from '../charts';
import { BREAK_EVEN, dec, int, pct } from '../format';
import { wilson } from '../stats';
import { Segmented, Skeleton, useSticky } from '../ui';

const VIEWS = [{ value: 'chart', label: 'Charts' }, { value: 'table', label: 'Table' }];

const coverCells = r => {
  const n = r.spread_games - (r.pushes || 0);
  if (!n) return { rate: '–', range: '–' };
  const [lo, hi] = wilson(r.covers, n);
  return { rate: pct(r.covers / n), range: `${pct(lo, 0)}–${pct(hi, 0)}` };
};

/** "7 of 12 seasons beat break-even; in 1 the whole interval did." */
function coverSummary(rows, who) {
  const decided = rows.filter(r => r.spread_games - (r.pushes || 0) > 0);
  if (decided.length === 0) return null;
  const above = decided.filter(r => r.covers / (r.spread_games - r.pushes) > BREAK_EVEN).length;
  const clear = decided.filter(r => wilson(r.covers, r.spread_games - r.pushes)[0] > BREAK_EVEN).length;
  return `${who} beat the ${pct(BREAK_EVEN)} break-even in ${above} of ${decided.length} seasons; in ${
    clear === 0 ? 'none of them' : clear === 1 ? 'one' : clear
  } was the whole 95% interval above it.`;
}

const niceMax = v => (v <= 10 ? 10 : Math.ceil(v / 10) * 10);

export function TeamSeasons({ data, name }) {
  const [view, setView] = useSticky('seasons.view', 'chart');
  if (!data) return <Skeleton lines={6} />;
  const rows = data.map(r => ({ ...r, season: r.season_year }));
  if (rows.length === 0) return <p className="muted">No seasons on record.</p>;
  return (
    <>
      <p className="section__sub">Regular season and playoffs. {coverSummary(rows, `The ${name}`)}</p>
      <Segmented label="Show as" value={view} onChange={setView} options={VIEWS} />
      {view === 'chart' ? (
        <div className="charts">
          <div>
            <h3 className="chart-title">Win rate</h3>
            <SeasonColumns rows={rows} value={r => r.wins / r.games} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]}
              yFormat={t => pct(t, 0)} label={`${name} win rate by season`}
              tip={r => [`${pct(r.wins / r.games)} won`, `${r.wins}–${r.games - r.wins}`]} />
          </div>
          <div>
            <h3 className="chart-title">Cover rate, with 95% intervals</h3>
            <SeasonRates what="covered" label={`${name} cover rate by season`}
              rows={rows.map(r => ({ season: r.season, k: r.covers, n: r.spread_games - r.pushes }))} />
          </div>
        </div>
      ) : (
        <SeasonTable rows={rows} columns={[
          { label: 'Record', value: r => `${r.wins}–${r.games - r.wins}` },
          { label: 'Win rate', value: r => pct(r.wins / r.games) },
          { label: 'Points', value: r => dec(r.avg_pts) },
          { label: 'Covers', value: r => `${r.covers} of ${r.spread_games - r.pushes}` },
          { label: 'Cover rate', value: r => coverCells(r).rate },
          { label: '95% interval', value: r => coverCells(r).range },
          { label: 'Underdog wins', value: r => `${r.underdog_wins} of ${r.underdog_games}` },
        ]} />
      )}
    </>
  );
}

export function PlayerSeasons({ data }) {
  const [view, setView] = useSticky('seasons.view', 'chart');
  if (!data) return <Skeleton lines={6} />;
  const rows = data.map(r => ({ ...r, season: r.season_year }));
  if (rows.length === 0) return <p className="muted">No seasons on record.</p>;
  const top = niceMax(Math.max(...rows.map(r => r.pts || 0)));
  const step = top > 20 ? 10 : 5;
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  const betting = rows.filter(r => r.spread_games > 0);
  return (
    <>
      <p className="section__sub">
        Regular season and playoff games he played. {coverSummary(betting, 'His team')}
      </p>
      <Segmented label="Show as" value={view} onChange={setView} options={VIEWS} />
      {view === 'chart' ? (
        <div className="charts">
          <div>
            <h3 className="chart-title">Points per game</h3>
            <SeasonColumns rows={rows} value={r => r.pts} domain={[0, top]} ticks={ticks} yFormat={t => String(t)}
              label="Points per game by season"
              tip={r => [`${dec(r.pts)} points`, `${dec(r.reb)} rebounds, ${dec(r.ast)} assists`, `${int(r.games)} games`]} />
          </div>
          {betting.length > 0 && (
            <div>
              <h3 className="chart-title">His team's cover rate, with 95% intervals</h3>
              <SeasonRates what="covered" label="His team's cover rate by season"
                rows={betting.map(r => ({ season: r.season, k: r.covers, n: r.spread_games - r.pushes }))} />
            </div>
          )}
        </div>
      ) : (
        <SeasonTable rows={rows} columns={[
          { label: 'Games', value: r => int(r.games) },
          { label: 'Points', value: r => dec(r.pts) },
          { label: 'Rebounds', value: r => dec(r.reb) },
          { label: 'Assists', value: r => dec(r.ast) },
          { label: 'Minutes', value: r => dec(r.min) },
          { label: 'Team covered', value: r => (r.spread_games ? `${r.covers} of ${r.spread_games - r.pushes}` : '–') },
          { label: 'Cover rate', value: r => coverCells(r).rate },
        ]} />
      )}
    </>
  );
}
