import { Link } from 'react-router-dom';

interface Props {
  goalies: Record<string, string>[];
  teamId: string;
}

export default function GoalieStats({ goalies, teamId }: Props) {
  if (goalies.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No goalie stats available.</p>;
  }

  const columns = Object.keys(goalies[0]).filter((c) => !c.startsWith('_'));

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
          {goalies.map((goalie, index) => {
            const playerId = goalie['_playerId'];
            return (
              <tr key={index} className="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`py-2.5 px-3 ${
                      col === 'Name'
                        ? 'text-left font-medium'
                        : col === 'Save %' || col === 'GAA'
                        ? 'text-right text-blue-300 font-semibold'
                        : 'text-right text-gray-300'
                    }`}
                  >
                    {col === 'Name' && playerId ? (
                      <Link
                        to={`/${teamId}/player/${playerId}`}
                        className="text-white hover:text-blue-300 transition-colors"
                      >
                        {goalie[col] || '—'}
                      </Link>
                    ) : (
                      goalie[col] || '—'
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
