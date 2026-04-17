import { Link } from 'react-router-dom';
import type { Game } from '../pages/TeamPage';

interface Props {
  games: Game[];
  teamName: string;
  teamId: string;
}

export default function ScheduleTable({ games, teamName, teamId }: Props) {
  if (games.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No games found.</p>;
  }

  const played = games.filter((g) => g.awayGoals !== '' && g.homeGoals !== '');
  const upcoming = games.filter((g) => !g.awayGoals && !g.homeGoals);

  const wins = played.filter((g) => {
    const isHome = g.homeTeam === teamName;
    const scored = parseInt(isHome ? g.homeGoals : g.awayGoals) || 0;
    const allowed = parseInt(isHome ? g.awayGoals : g.homeGoals) || 0;
    return scored > allowed;
  }).length;

  const losses = played.length - wins;

  return (
    <div className="space-y-4">
      {/* Record summary */}
      {played.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <StatCard value={played.length} label="Played" />
          <StatCard value={wins} label="Wins" color="text-green-400" />
          <StatCard value={losses} label="Losses" color="text-red-400" />
          <StatCard value={upcoming.length} label="Remaining" />
        </div>
      )}

      {/* Games list */}
      <div className="space-y-2">
        {games.map((game, index) => {
          const isPlayed = game.awayGoals !== '' || game.homeGoals !== '';
          const isHome = game.homeTeam === teamName;
          const opponent = isHome ? game.awayTeam : game.homeTeam;
          const ourGoals = parseInt(isHome ? game.homeGoals : game.awayGoals);
          const theirGoals = parseInt(isHome ? game.awayGoals : game.homeGoals);
          const won = isPlayed && ourGoals > theirGoals;
          const lost = isPlayed && ourGoals < theirGoals;

          return (
            <div
              key={index}
              className={`bg-gray-900 rounded-lg px-3 py-3 border ${
                won ? 'border-green-800/50' : lost ? 'border-red-800/50' : 'border-gray-800'
              }`}
            >
              {/* Top row: # | badge | opponent | score | sheet */}
              <div className="flex items-center gap-2">
                {/* Game number */}
                {isPlayed && game.gameId ? (
                  <Link
                    to={`/${teamId}/game/${game.gameId}`}
                    className="text-blue-400 hover:text-blue-300 text-xs w-8 text-center shrink-0 font-mono"
                  >
                    {game.gameNumber}
                  </Link>
                ) : (
                  <div className="text-gray-600 text-xs w-8 text-center shrink-0 font-mono">
                    {game.gameNumber}
                  </div>
                )}

                {/* HOME/AWAY badge */}
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                  isHome ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'
                }`}>
                  {isHome ? 'HOME' : 'AWAY'}
                </span>

                {/* Opponent — takes remaining space */}
                <span className="text-sm text-white flex-1 min-w-0 truncate">vs {opponent}</span>

                {/* Score */}
                <div className="text-right shrink-0">
                  {isPlayed ? (
                    <div className="flex items-center gap-1">
                      <span className={`text-base font-bold ${won ? 'text-green-400' : lost ? 'text-red-400' : 'text-gray-300'}`}>
                        {ourGoals}–{theirGoals}
                      </span>
                      <span className={`text-xs font-bold ${won ? 'text-green-500' : lost ? 'text-red-500' : 'text-gray-500'}`}>
                        {won ? 'W' : lost ? 'L' : 'T'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">TBD</span>
                  )}
                </div>

                {/* Scoresheet link */}
                {game.hasScoresheet && game.scoresheetUrl && (
                  <a
                    href={`https://stats.panthers.timetoscore.com/${game.scoresheetUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                  >
                    Sheet
                  </a>
                )}
              </div>

              {/* Bottom row: date · time · rink */}
              <div className="flex items-center gap-1.5 mt-1.5 ml-10 text-xs text-gray-500">
                <span>{game.date}</span>
                {game.time && <><span>·</span><span>{game.time}</span></>}
                {game.rink && <><span>·</span><span className="truncate">{game.rink}</span></>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ value, label, color = 'text-white' }: { value: number; label: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg px-4 py-2.5 text-center min-w-[60px]">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
