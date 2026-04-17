import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import ScheduleTable from '../components/ScheduleTable';
import PlayerStats from '../components/PlayerStats';
import GoalieStats from '../components/GoalieStats';
import TeamStats from '../components/TeamStats';

type Tab = 'schedule' | 'players' | 'goalies' | 'team';

interface ScheduleData {
  teamName: string;
  games: Game[];
  players: Record<string, string>[];
  goalies: Record<string, string>[];
  teamStats: Record<string, string>;
}

export interface Game {
  gameId: string;
  gameNumber: string;
  date: string;
  time: string;
  rink: string;
  league: string;
  level: string;
  awayTeam: string;
  awayGoals: string;
  homeTeam: string;
  homeGoals: string;
  type: string;
  scoresheetUrl: string | null;
  hasScoresheet: boolean;
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('schedule');

  const season = searchParams.get('season') || '17';
  const league = searchParams.get('league') || '1';

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/schedule?team=${teamId}&season=${season}&league=${league}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [teamId, season, league]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'schedule', label: 'Schedule', count: data?.games.length },
    { key: 'players', label: 'Players', count: data?.players.length },
    { key: 'goalies', label: 'Goalies', count: data?.goalies.length },
    { key: 'team', label: 'Team Stats' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 w-full">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition-colors text-sm shrink-0">
            ← Back
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl shrink-0">🏒</span>
              <h1 className="text-lg font-bold truncate">
                {loading ? `Team ${teamId}` : (data?.teamName || `Team ${teamId}`)}
              </h1>
            </div>
            {data && (
              <p className="text-gray-400 text-sm mt-0.5 truncate">
                {data.games[0]?.level} · {data.games[0]?.league}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="bg-gray-900 border-b border-gray-800 w-full">
        <div className="max-w-5xl mx-auto overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 w-full">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🏒</div>
              <p>Loading schedule...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-5 py-4 text-red-300">
            Failed to load data: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {activeTab === 'schedule' && (
              <ScheduleTable games={data.games} teamName={data.teamName} teamId={teamId!} />
            )}
            {activeTab === 'players' && (
              <PlayerStats players={data.players} teamId={teamId!} />
            )}
            {activeTab === 'goalies' && (
              <GoalieStats goalies={data.goalies} teamId={teamId!} />
            )}
            {activeTab === 'team' && <TeamStats stats={data.teamStats} />}
          </>
        )}
      </div>
    </div>
  );
}
