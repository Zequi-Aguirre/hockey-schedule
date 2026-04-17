import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface ScoreRow { side: string; team: string; p1: string; p2: string; p3: string; ot: string; so: string; final: string; }
interface ScoringRow { per: string; time: string; type: string; team: string; goal: string; ass1: string; ass2: string; }
interface PenaltyRow { per: string; time: string; team: string; number: string; infraction: string; min: string; }
interface RosterPlayer { '#': string; pos: string; name: string; }

interface GameData {
  gameId: string;
  info: Record<string, string>;
  score: ScoreRow[];
  scoring: ScoringRow[];
  penalties: PenaltyRow[];
  rosters: Record<string, RosterPlayer[]>;
}

export default function GamePage() {
  const { teamId, gameId } = useParams<{ teamId: string; gameId: string }>();
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    setLoading(true);
    fetch(`/api/game?game_id=${gameId}`, { cache: 'no-store' })
      .then((res) => { if (!res.ok) throw new Error(`Error ${res.status}`); return res.json(); })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { console.error('game fetch error:', err); setError(err.message); setLoading(false); });
  }, [gameId]);

  const teamNames = (data?.score ?? []).map(s => s.team).filter(Boolean);
  const subtitle = teamNames.length >= 2 ? `${teamNames[0]} vs ${teamNames[1]}` : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to={`/${teamId}`} className="text-gray-400 hover:text-white text-sm shrink-0">← Back</Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">Game #{gameId}</h1>
            {subtitle && <p className="text-gray-400 text-sm truncate">{subtitle}</p>}
          </div>
          <a
            href={`https://stats.panthers.timetoscore.com/generate-scorecard.php?game_id=${gameId}`}
            target="_blank" rel="noreferrer"
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded transition-colors shrink-0"
          >
            PDF Sheet
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="text-center"><div className="text-4xl mb-3 animate-pulse">🏒</div><p>Loading game...</p></div>
          </div>
        )}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-5 py-4 text-red-300">
            Failed to load game: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* Game info */}
            {Object.keys(data.info ?? {}).length > 0 && (
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                {data.info.date && <span>📅 {data.info.date}</span>}
                {data.info.time && <span>🕐 {data.info.time}</span>}
                {data.info.location && <span>📍 {data.info.location}</span>}
                {data.info.level && <span>🏒 {data.info.level}</span>}
              </div>
            )}

            {/* Scoreboard */}
            {(data.score ?? []).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="text-left py-2 px-4 font-medium">Team</th>
                      {['1', '2', '3', 'OT', 'SO'].map(p => (
                        <th key={p} className="text-center py-2 px-2 font-medium w-10">{p}</th>
                      ))}
                      <th className="text-center py-2 px-4 font-bold text-white">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.score ?? []).map((row, i) => (
                      <tr key={i} className={i < data.score.length - 1 ? 'border-b border-gray-800' : ''}>
                        <td className="py-3 px-4 font-semibold text-white">
                          <span className="text-xs text-gray-500 mr-2">{row.side}</span>
                          {row.team}
                        </td>
                        {[row.p1, row.p2, row.p3, row.ot, row.so].map((val, j) => (
                          <td key={j} className="text-center py-3 px-2 text-gray-300">{val || '—'}</td>
                        ))}
                        <td className="text-center py-3 px-4 font-bold text-xl text-white">{row.final || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Scoring */}
            {(data.scoring ?? []).length > 0 && (
              <Section title="Goals">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="text-left py-2 px-3">Per</th>
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-left py-2 px-3">Goal</th>
                        <th className="text-left py-2 px-3">Assist</th>
                        <th className="text-left py-2 px-3">Assist</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.scoring ?? []).map((g, i) => (
                        <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-gray-400">{g.per}</td>
                          <td className="py-2 px-3 text-gray-300">
                            {g.time}
                            {g.type && <span className="ml-1.5 text-xs text-yellow-500 font-medium">{g.type}</span>}
                          </td>
                          <td className="py-2 px-3 text-gray-300">{g.team}</td>
                          <td className="py-2 px-3 text-white font-medium">{g.goal}</td>
                          <td className="py-2 px-3 text-gray-300">{g.ass1 || '—'}</td>
                          <td className="py-2 px-3 text-gray-300">{g.ass2 || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Penalties */}
            {(data.penalties ?? []).length > 0 && (
              <Section title="Penalties">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-400 text-xs">
                        <th className="text-left py-2 px-3">Per</th>
                        <th className="text-left py-2 px-3">Time</th>
                        <th className="text-left py-2 px-3">Team</th>
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">Infraction</th>
                        <th className="text-left py-2 px-3">Min</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.penalties ?? []).map((p, i) => (
                        <tr key={i} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30">
                          <td className="py-2 px-3 text-gray-400">{p.per}</td>
                          <td className="py-2 px-3 text-gray-300">{p.time || '—'}</td>
                          <td className="py-2 px-3 text-gray-300">{p.team}</td>
                          <td className="py-2 px-3 text-gray-400">{p.number}</td>
                          <td className="py-2 px-3 text-white">{p.infraction}</td>
                          <td className="py-2 px-3 text-gray-300">{p.min}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Rosters side by side */}
            {Object.keys(data.rosters ?? {}).length > 0 && (
              <Section title="Rosters">
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-800">
                  {Object.entries(data.rosters ?? {}).map(([team, players]) => (
                    <div key={team}>
                      <div className="px-4 py-2 bg-gray-800/50 text-sm font-semibold text-gray-300">{team}</div>
                      <div className="divide-y divide-gray-800/50">
                        {players.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-800/30 text-sm">
                            <span className="text-gray-500 w-6 text-right shrink-0">{p['#']}</span>
                            <span className="text-gray-400 w-4 shrink-0">{p.pos}</span>
                            <span className="text-white">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {!(data.score ?? []).length && !(data.scoring ?? []).length && !Object.keys(data.rosters ?? {}).length && (
              <p className="text-gray-400 py-8 text-center">Scoresheet data not available for this game.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h2>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">{children}</div>
    </div>
  );
}
