import { Link } from 'react-router-dom';
import { RINKS } from '../brand';

export default function RinkPicker() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <span>🏒</span>
            <span>Hockey Schedule</span>
          </div>
          <p className="text-gray-400 text-sm mt-1">Pick your rink to see divisions, standings &amp; schedules.</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pick your rink</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {RINKS.map((rink) => (
            <Link
              key={rink.league}
              to={`/league/${rink.league}`}
              className="group bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500 hover:bg-gray-800/60 transition-colors flex flex-col"
            >
              <div className="text-4xl mb-3">{rink.emoji}</div>
              <div className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">
                {rink.name}
              </div>
              <div className="text-sm text-gray-400 mt-1 flex-1">{rink.blurb}</div>
              <div className="text-blue-400 text-sm font-medium mt-4">View divisions →</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
