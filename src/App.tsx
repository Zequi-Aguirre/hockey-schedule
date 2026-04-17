import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeamPage from './pages/TeamPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import PlayerPage from './pages/PlayerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:teamId" element={<TeamPage />} />
        <Route path="/:teamId/game/:gameId" element={<GamePage />} />
        <Route path="/:teamId/player/:playerId" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
