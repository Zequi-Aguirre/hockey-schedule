import type { Game } from '../pages/TeamPage';

interface Props {
  games: Game[];
  teamName: string;
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export default function ScheduleTable({ games, teamName }: Props) {
  if (games.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No games found.</p>;
  }

  const today = new Date();
  const played = games.filter((g) => g.awayGoals !== '' && g.homeGoals !== '');
  const upcoming = games.filter((g) => !g.awayGoals && !g.homeGoals);

  const wins = played.filter((g) => {
    const isHome = g.homeTeam.toLowerCase().includes(teamName.toLowerCase());
    const scored = parseInt(isHome ? g.homeGoals : g.awayGoals) || 0;
    const allowed = parseInt(isHome ? g.awayGoals : g.homeGoals) || 0;
    return scored > allowed;
  }).length;

  const losses = played.filter((g) => {
    const isHome = g.homeTeam.toLowerCase().includes(teamName.toLowerCase());
    const scored = parseInt(isHome ? g.homeGoals : g.awayGoals) || 0;
    const allowed = parseInt(isHome ? g.awayGoals : g.homeGoals) || 0;
    return scored < allowed;
  }).length;

  return (
    <div className="space-y-6">
      {/* Record summary */}
      {played.length > 0 && (
        <div className="flex gap-4">
          <div className="bg-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl font-bold text-white">{played.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">Played</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl font-bold text-green-400">{wins}</div>
            <div className="text-xs text-gray-400 mt-0.5">Wins</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl font-bold text-red-400">{losses}</div>
            <div className="text-xs text-gray-400 mt-0.5">Losses</div>
          </div>
          <div className="bg-gray-800 rounded-lg px-5 py-3 text-center">
            <div className="text-2xl font-bold text-gray-300">{upcoming.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">Remaining</div>
          </div>
        </div>
      )}

      {/* Games list */}
      <div className="space-y-2">
        {games.map((game, index) => {
          const isPlayed = game.awayGoals !== '' || game.homeGoals !== '';
          const isHome = game.homeTeam.toLowerCase().includes(teamName.toLowerCase());
          const opponent = isHome ? game.awayTeam : game.homeTeam;
          const ourGoals = isHome ? parseInt(game.homeGoals) : parseInt(game.awayGoals);
          const theirGoals = isHome ? parseInt(game.awayGoals) : parseInt(game.homeGoals);
          const won = isPlayed && ourGoals > theirGoals;
          const lost = isPlayed && ourGoals < theirGoals;
          const gameDate = parseDate(game.date);
          const isPast = gameDate ? gameDate < today : false;

          return (
            <div
              key={index}
              className={`flex items-center gap-4 bg-gray-900 rounded-lg px-4 py-3 border ${
                isPlayed
                  ? won
                    ? 'border-green-800/50'
                    : lost
                    ? 'border-red-800/50'
                    : 'border-gray-700'
                  : 'border-gray-800'
              }`}
            >
              {/* Game number */}
              <div className="text-gray-500 text-xs w-6 text-center shrink-0">
                {game.gameNumber}
              </div>

              {/* Date + time */}
              <div className="w-28 shrink-0">
                <div className={`text-sm font-medium ${isPast ? 'text-gray-300' : 'text-white'}`}>
                  {game.date}
                </div>
                <div className="text-xs text-gray-500">{game.time}</div>
              </div>

              {/* Home/Away badge + opponent */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${
                  isHome ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-300'
                }`}>
                  {isHome ? 'HOME' : 'AWAY'}
                </span>
                <span className="text-sm text-white truncate">vs {opponent}</span>
              </div>

              {/* Rink */}
              <div className="text-xs text-gray-500 hidden sm:block w-32 text-right truncate">
                {game.rink}
              </div>

              {/* Score or upcoming */}
              <div className="text-right shrink-0 w-20">
                {isPlayed ? (
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`text-lg font-bold ${won ? 'text-green-400' : lost ? 'text-red-400' : 'text-gray-300'}`}>
                      {ourGoals}–{theirGoals}
                    </span>
                    <span className={`text-xs font-bold ${won ? 'text-green-500' : lost ? 'text-red-500' : 'text-gray-500'}`}>
                      {won ? 'W' : lost ? 'L' : 'T'}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">Upcoming</span>
                )}
              </div>

              {/* Scoresheet link */}
              {game.scoresheetUrl && (
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
          );
        })}
      </div>
    </div>
  );
}
