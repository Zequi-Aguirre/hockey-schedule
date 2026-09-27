import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FEATURED_TEAMS, DEFAULT_LEAGUE, DEFAULT_SEASON } from '../brand';

interface Team {
  _teamId?: string;
  _level?: string;
  name?: string;
  [key: string]: string | undefined;
}

const LEAGUE = DEFAULT_LEAGUE;
const SEASON = DEFAULT_SEASON;

function teamName(team: Team): string {
  if (team.name) return team.name;
  const val = Object.entries(team).find(
    ([k, v]) => !k.startsWith('_') && v && !/^\d+$/.test(String(v)),
  );
  return val ? String(val[1]) : '';
}

function teamHref(teamId: string) {
  return `/${teamId}?league=${LEAGUE}&season=${SEASON}`;
}

export default function LandingPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/league?league=${LEAGUE}&season=${SEASON}`)
      .then((res) => res.json())
      .then((data) => {
        setTeams(data.teams || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const featuredIds = useMemo(() => new Set(FEATURED_TEAMS.map((t) => t.teamId)), []);

  const sorted = useMemo(
    () =>
      [...teams]
        .filter((t) => t._teamId && teamName(t))
        .sort((a, b) => teamName(a).toLowerCase().localeCompare(teamName(b).toLowerCase())),
    [teams],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) => teamName(t).toLowerCase().includes(q));
  }, [sorted, query]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span>🏒</span>
            <span>Hockey Schedules</span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Find your team — schedules, scores &amp; stats. Better than the official site.
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Featured / branded teams */}
        {FEATURED_TEAMS.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Featured</h2>
            <div className="space-y-3">
              {FEATURED_TEAMS.map((t) => (
                <Link
                  key={t.teamId}
                  to={teamHref(t.teamId)}
                  className="flex items-center gap-4 bg-brand-navy border border-brand-gold/40 rounded-xl px-4 py-4 hover:border-brand-gold transition-colors"
                >
                  <img
                    src={t.logo}
                    alt={t.name}
                    className="w-14 h-14 rounded-lg object-cover ring-2 ring-brand-gold/50 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{t.name}</div>
                    <div className="text-brand-columbia text-sm truncate">View schedule &amp; stats</div>
                  </div>
                  <span className="text-brand-gold text-lg shrink-0">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Search */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All teams</h2>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams…"
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 placeholder-gray-500 text-sm"
          />
        </div>

        {/* Team list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">Loading teams…</div>
        ) : filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((t) => {
              const id = t._teamId!;
              const name = teamName(t);
              const branded = featuredIds.has(id);
              return (
                <Link
                  key={id}
                  to={teamHref(id)}
                  className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 transition-colors group"
                >
                  <span className="text-white font-medium truncate group-hover:text-blue-300 transition-colors">
                    {name}
                    {branded && <span className="ml-2 text-xs text-brand-gold">★</span>}
                  </span>
                  <span className="text-gray-600 group-hover:text-gray-400 ml-3 shrink-0">→</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No teams match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
