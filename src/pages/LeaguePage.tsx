import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRinkByLeague } from '../brand';

interface DivTeam {
  rank: string;
  name: string;
  teamId: string | null;
  stats: Record<string, string>;
}
interface Division {
  name: string;
  columns: string[];
  teams: DivTeam[];
}

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rink = getRinkByLeague(leagueId);

  useEffect(() => {
    if (!leagueId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/league?league=${leagueId}&season=0`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((data) => { setDivisions(data.divisions || []); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [leagueId]);

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 w-full">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm shrink-0">← Rinks</Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{rink?.name || `League ${leagueId}`}</h1>
            <p className="text-gray-400 text-sm mt-0.5 truncate">Divisions &amp; standings</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 w-full">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🏒</div>
              <p>Loading standings…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-5 py-4 text-red-300">
            Failed to load standings: {error}
          </div>
        )}

        {!loading && !error && divisions.length === 0 && (
          <p className="text-center text-gray-500 py-8">No divisions found for this league.</p>
        )}

        {!loading && divisions.map((div) => (
          <section key={div.name} className="mb-8">
            <h2 className="text-sm font-bold text-white mb-2 px-1">{div.name}</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800 text-xs">
                      <th className="text-left py-2 pl-3 pr-2 font-medium w-6">#</th>
                      <th className="text-left py-2 pr-3 font-medium sticky left-0 bg-gray-900">Team</th>
                      {div.columns.map((c) => (
                        <th key={c} className="text-center py-2 px-2 font-medium whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {div.teams.map((t, i) => (
                      <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/40 transition-colors">
                        <td className="py-2.5 pl-3 pr-2 text-gray-500">{t.rank}</td>
                        <td className="py-2.5 pr-3 font-medium sticky left-0 bg-gray-900">
                          {t.teamId ? (
                            <Link to={`/${t.teamId}?league=${leagueId}&season=0`} className="text-white hover:text-blue-300 transition-colors whitespace-nowrap">
                              {t.name}
                            </Link>
                          ) : (
                            <span className="text-white whitespace-nowrap">{t.name}</span>
                          )}
                        </td>
                        {div.columns.map((c) => (
                          <td
                            key={c}
                            className={`text-center py-2.5 px-2 whitespace-nowrap ${
                              c === 'PTS' ? 'font-semibold text-white' : 'text-gray-300'
                            }`}
                          >
                            {t.stats[c] || '0'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
