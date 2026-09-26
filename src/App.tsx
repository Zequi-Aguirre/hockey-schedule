import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeamPage from './pages/TeamPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import PlayerPage from './pages/PlayerPage';
import { DEFAULT_TEAM } from './brand';

export default function App() {
  // Landing page defaults to the branded team's schedule.
  const defaultTeamPath = `/${DEFAULT_TEAM.teamId}?league=${DEFAULT_TEAM.league}&season=${DEFAULT_TEAM.season}`;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={defaultTeamPath} replace />} />
        <Route path="/browse" element={<HomePage />} />
        <Route path="/:teamId" element={<TeamPage />} />
        <Route path="/:teamId/game/:gameId" element={<GamePage />} />
        <Route path="/:teamId/player/:playerId" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
