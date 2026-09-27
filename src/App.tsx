import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeamHome from './pages/TeamHome';
import TeamPage from './pages/TeamPage';
import LandingPage from './pages/LandingPage';
import GamePage from './pages/GamePage';
import PlayerPage from './pages/PlayerPage';
import { FEATURED_TEAMS } from './brand';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        {/* Friendly aliases for branded teams (e.g. /hookers). Static paths, so
            they resolve ahead of the generic /:teamId route. Stable links to pin. */}
        {FEATURED_TEAMS.map((t) => (
          <Route
            key={t.slug}
            path={`/${t.slug}`}
            element={<Navigate to={`/${t.teamId}?league=${t.league}&season=${t.season}`} replace />}
          />
        ))}

        <Route path="/:teamId" element={<TeamHome />} />
        <Route path="/:teamId/schedule" element={<TeamPage />} />
        <Route path="/:teamId/game/:gameId" element={<GamePage />} />
        <Route path="/:teamId/player/:playerId" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
