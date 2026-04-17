import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface PlayerData {
  name: string;
  bio: Record<string, string>;
  seasons: Record<string, string>[];
  games: Record<string, string>[];
}

export default function PlayerPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'seasons' | 'games'>('seasons');

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    fetch(`/api/player?player_id=${playerId}`)
      .then((res) => { if (!res.ok) throw new Error(`Error ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [playerId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to={`/${teamId}`} className="text-gray-400 hover:text-white text-sm shrink-0">
            ← Back
          </Link>
          <div>
            <h1 className="text-lg font-bold">
              {data?.name || (loading ? 'Loading...' : 'Player')}
            </h1>
            {data?.bio && Object.keys(data.bio).length > 0 && (
              <p className="text-gray-400 text-sm mt-0.5">
                {Object.entries(data.bio).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 w-full">
        <div className="max-w-5xl mx-auto overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {(['seasons', 'games'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize ${
                  tab === t
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t === 'seasons' ? 'Season Summary' : 'Game by Game'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🏒</div>
              <p>Loading player...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-5 py-4 text-red-300">
            Failed to load player: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {tab === 'seasons' && (
              data.seasons.length > 0 ? (
                <StatsTable rows={data.seasons} highlightCol="Pts" />
              ) : (
                <p className="text-gray-400 py-8 text-center">No season stats available.</p>
              )
            )}
            {tab === 'games' && (
              data.games.length > 0 ? (
                <StatsTable rows={data.games} highlightCol="Pts" />
              ) : (
                <p className="text-gray-400 py-8 text-center">No game-by-game data available.</p>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatsTable({ rows, highlightCol }: { rows: Record<string, string>[]; highlightCol?: string }) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            {columns.map((col) => (
              <th key={col} className="py-2 px-3 text-left text-xs font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
              {columns.map((col) => (
                <td
                  key={col}
                  className={`py-2.5 px-3 whitespace-nowrap ${
                    col === highlightCol
                      ? 'text-blue-300 font-semibold'
                      : col === 'Team' || col === 'Season' || col === 'Opponent' || col === 'Date'
                      ? 'text-white font-medium'
                      : 'text-gray-300'
                  }`}
                >
                  {row[col] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
