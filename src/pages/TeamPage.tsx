import { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import ScheduleTable from '../components/ScheduleTable';
import PlayerStats from '../components/PlayerStats';
import GoalieStats from '../components/GoalieStats';
import TeamStats from '../components/TeamStats';
import { getBrandByTeamId, getTeamTheme, DEFAULT_LEAGUE, DEFAULT_SEASON } from '../brand';
import { useSchedule } from '../useSchedule';

type Tab = 'schedule' | 'players' | 'goalies' | 'team';

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('schedule');

  const brand = getBrandByTeamId(teamId);
  const theme = getTeamTheme(teamId);
  const season = searchParams.get('season') || brand?.season || DEFAULT_SEASON;
  const league = searchParams.get('league') || brand?.league || DEFAULT_LEAGUE;
  const query = `?league=${league}&season=${season}`;

  const { data, loading, error } = useSchedule(teamId, season, league);

  // Branded teams show their given name; everyone else shows the scraped name.
  const displayName = brand?.name || (loading ? `Team ${teamId}` : (data?.teamName || `Team ${teamId}`));
  const subtitle = data?.games[0]
    ? `${data.games[0].level} · ${data.games[0].league}`
    : (brand?.tagline || '');

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'schedule', label: 'Schedule', count: data?.games.length },
    { key: 'players', label: 'Players', count: data?.players.length },
    { key: 'goalies', label: 'Goalies', count: data?.goalies.length },
    { key: 'team', label: 'Team Stats' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      {/* Header */}
      <div className={`${theme.headerClass} px-4 py-4 w-full`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link
            to={`/${teamId}${query}`}
            className={`${theme.subtitleClass} hover:text-white transition-colors text-sm shrink-0`}
          >
            ← Back
          </Link>
          {brand ? (
            <img
              src={brand.logo}
              alt={brand.name}
              className={`w-11 h-11 rounded-lg shrink-0 object-cover ring-2 ${theme.ringClass}`}
            />
          ) : (
            <span className="text-xl shrink-0">🏒</span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{displayName}</h1>
            {subtitle && <p className={`${theme.subtitleClass} text-sm mt-0.5 truncate`}>{subtitle}</p>}
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
                    ? theme.tabActiveClass
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
              <ScheduleTable games={data.games} teamName={data.teamName} teamId={teamId!} theme={theme} />
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
