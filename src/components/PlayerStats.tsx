interface Props {
  players: Record<string, string>[];
}

const PRIORITY_COLS = ['Name', '#', 'GP', 'Goals', 'Ass.', 'PPG', 'PPA', 'GWG', 'PIMs', '+/-', 'Pts'];

export default function PlayerStats({ players }: Props) {
  if (players.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No player stats available.</p>;
  }

  const allColumns = Object.keys(players[0]);
  const columns = [
    ...PRIORITY_COLS.filter((c) => allColumns.includes(c)),
    ...allColumns.filter((c) => !PRIORITY_COLS.includes(c)),
  ];

  const sorted = [...players].sort((a, b) => {
    return (parseInt(b['Pts']) || 0) - (parseInt(a['Pts']) || 0);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
          {sorted.map((player, index) => (
            <tr
              key={index}
              className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className={`py-2.5 px-3 ${
                    col === 'Name'
                      ? 'text-left text-white font-medium'
                      : col === 'Pts'
                      ? 'text-right text-blue-300 font-semibold'
                      : 'text-right text-gray-300'
                  }`}
                >
                  {player[col] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
