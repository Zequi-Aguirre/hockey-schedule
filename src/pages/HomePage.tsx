import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LEAGUES = [
  { id: '1', name: 'Panther Ice Hockey (Adult)' },
  { id: '4', name: 'Panther Ice Hockey (Youth)' },
];

interface Team {
  _teamId?: string;
  _level?: string;
  [key: string]: string | undefined;
}

export default function HomePage() {
  const [teamId, setTeamId] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('1');
  const [teams, setTeams] = useState<Team[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [loadingTeams, setLoadingTeams] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoadingTeams(true);
    setTeams([]);
    setLevels([]);
    setSelectedLevel('all');

    fetch(`/api/league?league=${selectedLeague}&season=0`)
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams || []);
        setLevels(data.levels || []);
        setLoadingTeams(false);
      })
      .catch(() => setLoadingTeams(false));
  }, [selectedLeague]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = teamId.trim();
    if (trimmed) navigate(`/${trimmed}?league=${selectedLeague}`);
  }

  const nameKey = teams[0] ? Object.keys(teams[0]).find(k => !k.startsWith('_') && teams[0][k] && k !== 'W' && k !== 'L' && k !== 'T' && k !== 'Pts' && k !== 'GP') || '' : '';

  const filteredTeams = selectedLevel === 'all'
    ? teams
    : teams.filter(t => t._level === selectedLevel);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🏒</div>
          <h1 className="text-3xl font-bold text-white mb-2">Panthers Hockey</h1>
          <p className="text-gray-400">Browse teams or enter a team ID directly</p>
        </div>

        {/* League selector */}
        <div className="flex gap-2 mb-6 justify-center">
          {LEAGUES.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLeague(l.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedLeague === l.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>

        {/* Manual team ID entry */}
        <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
          <input
            type="text"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="Enter team ID directly (e.g. 201)"
            className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
          >
            Go
          </button>
        </form>

        {/* Level filter */}
        {levels.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedLevel === 'all' ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {levels.map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLevel(l)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  selectedLevel === l ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        )}

        {/* Teams list */}
        {loadingTeams ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">Loading teams...</div>
        ) : filteredTeams.length > 0 ? (
          <div className="space-y-2">
            {filteredTeams.map((team, i) => {
              const name = nameKey ? team[nameKey] : Object.values(team).find(v => v && !String(v).match(/^\d+$/) && !String(v).startsWith('_'));
              const id = team._teamId;
              const level = team._level;

              if (!id || !name) return null;

              return (
                <Link
                  key={i}
                  to={`/${id}?league=${selectedLeague}`}
                  className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 transition-colors group"
                >
                  <div>
                    <div className="text-white font-medium group-hover:text-blue-300 transition-colors">{name}</div>
                    {level && <div className="text-xs text-gray-500 mt-0.5">{level}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    {['W', 'L', 'T', 'Pts'].filter(k => team[k] !== undefined && team[k] !== '').map(k => (
                      <div key={k} className="text-center">
                        <div className="text-sm font-semibold text-gray-200">{team[k]}</div>
                        <div className="text-xs text-gray-500">{k}</div>
                      </div>
                    ))}
                    <span className="text-gray-600 group-hover:text-gray-400 ml-1">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No teams found for this league.</p>
        )}
      </div>
    </div>
  );
}
