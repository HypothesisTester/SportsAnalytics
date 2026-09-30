import React, { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Empty, Icon, useTitle } from './ui';
import Games from './views/Games';
import Players from './views/Players';
import Teams from './views/Teams';
import Strategies from './views/Strategies';
import Leaderboards from './views/Leaderboards';

const REPO = 'https://github.com/HypothesisTester/SportsAnalytics';

const NAV = [
  { to: '/', label: 'Games', match: p => p === '/' || p.startsWith('/games') },
  { to: '/players', label: 'Players' },
  { to: '/teams', label: 'Teams' },
  { to: '/strategies', label: 'Strategies' },
  { to: '/leaderboards', label: 'Leaderboards' },
];

function useTheme() {
  const current = () =>
    document.documentElement.dataset.theme ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [theme, setTheme] = useState(current);
  const toggle = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* private mode: not remembered */ }
    setTheme(next);
  };
  return [theme, toggle];
}

function Header() {
  const { pathname } = useLocation();
  const [theme, toggleTheme] = useTheme();
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link to="/" className="brand" aria-label="SportsAnalytics home">
          <Icon.Ball size={20} />
          <span>SportsAnalytics</span>
        </Link>
        <nav className="nav" aria-label="Sections">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to}
              className={({ isActive }) => ((item.match ? item.match(pathname) : isActive) ? 'nav__link is-active' : 'nav__link')}
              aria-current={(item.match ? item.match(pathname) : pathname.startsWith(item.to)) ? 'page' : undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__actions">
          <button type="button" className="icon-button" onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}>
            {theme === 'dark' ? <Icon.Sun /> : <Icon.Moon />}
          </button>
          <a className="icon-button" href={REPO} target="_blank" rel="noreferrer" aria-label="Source code on GitHub">
            <Icon.GitHub />
          </a>
        </div>
      </div>
    </header>
  );
}

function OldGameLink() {
  const { gameId } = useParams();
  return <Navigate to={`/games/${gameId}`} replace />;
}

function NotFound() {
  useTitle('Page not found');
  return (
    <div className="page">
      <Empty action={<Link className="button" to="/">Go to games</Link>}>There's no page at this address.</Empty>
    </div>
  );
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Games />} />
          <Route path="/games/:id" element={<Games />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<Players />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:id" element={<Teams />} />
          <Route path="/strategies" element={<Strategies />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/game/:gameId" element={<OldGameLink />} />
          <Route path="/team" element={<Navigate to="/teams" replace />} />
          <Route path="/trivia" element={<Navigate to="/strategies" replace />} />
          <Route path="/trivia_players" element={<Navigate to="/leaderboards" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
