import { useParams, useSearchParams, Link } from 'react-router-dom';
import { getBrandByTeamId, getTeamTheme, DEFAULT_LEAGUE, DEFAULT_SEASON } from '../brand';
import { useSchedule, computeRecord, relativeDay, type Game } from '../useSchedule';

export default function TeamHome() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();

  const brand = getBrandByTeamId(teamId);
  const theme = getTeamTheme(teamId);
  const season = searchParams.get('season') || brand?.season || DEFAULT_SEASON;
  const league = searchParams.get('league') || brand?.league || DEFAULT_LEAGUE;
  const query = `?league=${league}&season=${season}`;

  const { data, loading, error } = useSchedule(teamId, season, league);

  const displayName = brand?.name || (loading ? `Team ${teamId}` : (data?.teamName || `Team ${teamId}`));
  const record = data ? computeRecord(data.games, data.teamName) : null;
  const recordStr = record && record.played > 0
    ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`
    : null;
  const level = data?.games[0]?.level;

  const upcoming = (data?.games || []).filter((g) => !g.awayGoals && !g.homeGoals);
  const nextGame = upcoming[0];
  const previews = upcoming.slice(1, 3);

  const scheduleHref = `/${teamId}/schedule${query}`;

  function homeAway(g: Game) {
    return g.homeTeam === data?.teamName ? 'HOME' : 'AWAY';
  }
  function opponentOf(g: Game) {
    return g.homeTeam === data?.teamName ? g.awayTeam : g.homeTeam;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white w-full overflow-x-hidden">
      {/* Header */}
      <div className={`${theme.headerClass} px-4 py-4 w-full`}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/" className={`${theme.subtitleClass} hover:text-white transition-colors text-sm shrink-0`}>
            ← Teams
          </Link>
          {brand ? (
            <img
              src={brand.logo}
              alt={brand.name}
              className={`w-12 h-12 rounded-lg shrink-0 object-cover ring-2 ${theme.ringClass}`}
            />
          ) : (
            <span className="text-2xl shrink-0">🏒</span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{displayName}</h1>
            {(recordStr || level) && (
              <p className={`${theme.subtitleClass} text-sm mt-0.5 truncate`}>
                {recordStr && <span className="font-semibold">{recordStr}</span>}
                {recordStr && level && ' · '}
                {level}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 w-full">
        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3 animate-pulse">🏒</div>
              <p>Loading…</p>
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
            {/* Up Next heading + go-to-schedule link */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Up Next</h2>
              <Link to={scheduleHref} className={`${theme.accentText} text-sm font-medium hover:opacity-80`}>
                Go to schedule →
              </Link>
            </div>

            {/* Featured next-game hero card */}
            {nextGame ? (
              <div className={`bg-gray-900 rounded-2xl p-5 border ${theme.isBranded ? 'border-brand-gold/40' : 'border-gray-800'}`}>
                <div className="flex items-center justify-between">
                  <div className={`text-lg font-bold ${theme.accentText}`}>
                    {relativeDay(nextGame.date)}
                    {nextGame.time && <span className="text-gray-300 font-semibold ml-2">{nextGame.time}</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${theme.chipClass}`}>
                    {homeAway(nextGame)}
                  </span>
                </div>

                <div className="text-2xl font-bold text-white mt-3">Vs. {opponentOf(nextGame)}</div>

                <div className="mt-3 space-y-1 text-sm text-gray-300">
                  {nextGame.date && <div>📅 {nextGame.date}{nextGame.time ? ` · ${nextGame.time}` : ''}</div>}
                  {nextGame.rink && <div className="truncate">📍 {nextGame.rink}</div>}
                </div>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 text-center">
                <div className="text-lg font-semibold text-white">No upcoming games</div>
                <p className="text-gray-400 text-sm mt-1">The season schedule is complete.</p>
              </div>
            )}

            {/* Optional: next 1-2 upcoming preview rows */}
            {previews.length > 0 && (
              <div className="mt-3 space-y-2">
                {previews.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      homeAway(g) === 'HOME' ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-400'
                    }`}>
                      {homeAway(g)}
                    </span>
                    <span className="text-sm text-white flex-1 min-w-0 truncate">Vs. {opponentOf(g)}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {relativeDay(g.date)}{g.time ? ` · ${g.time}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Go to full schedule */}
            <Link
              to={scheduleHref}
              className={`mt-5 block w-full text-center font-semibold py-3 rounded-xl transition-opacity hover:opacity-90 ${theme.chipClass}`}
            >
              Go to Schedule
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
