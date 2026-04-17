import { Link } from 'react-router-dom';

interface Props {
  players: Record<string, string>[];
  teamId: string;
}

const PRIORITY_COLS = ['Name', '#', 'GP', 'Goals', 'Ass.', 'PPG', 'PPA', 'GWG', 'PIMs', '+/-', 'Pts'];

export default function PlayerStats({ players, teamId }: Props) {
  if (players.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No player stats available.</p>;
  }

  const allColumns = Object.keys(players[0]).filter((c) => !c.startsWith('_'));
  const columns = [
    ...PRIORITY_COLS.filter((c) => allColumns.includes(c)),
    ...allColumns.filter((c) => !PRIORITY_COLS.includes(c)),
  ];

  const sorted = [...players].sort((a, b) => (parseInt(b['Pts']) || 0) - (parseInt(a['Pts']) || 0));

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm min-w-max">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col}
                className={`py-2 px-3 font-medium text-xs whitespace-nowrap ${
                  col === 'Name' ? 'text-left' : 'text-right'
                }`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((player, index) => {
            const playerId = player['_playerId'];
            return (
              <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`py-2.5 px-3 ${
                      col === 'Name'
                        ? 'text-left font-medium'
                        : col === 'Pts'
                        ? 'text-right text-blue-300 font-semibold'
                        : 'text-right text-gray-300'
                    }`}
                  >
                    {col === 'Name' && playerId ? (
                      <Link
                        to={`/${teamId}/player/${playerId}`}
                        className="text-white hover:text-blue-300 transition-colors"
                      >
                        {player[col] || '—'}
                      </Link>
                    ) : (
                      player[col] || '—'
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
