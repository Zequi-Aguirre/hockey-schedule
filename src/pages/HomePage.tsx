import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [teamId, setTeamId] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = teamId.trim();
    if (trimmed) navigate(`/${trimmed}`);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🏒</div>
        <h1 className="text-4xl font-bold text-white mb-2">Hockey Schedule</h1>
        <p className="text-gray-400">Enter a team ID to view their schedule and stats</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-sm">
        <input
          type="text"
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          placeholder="Team ID (e.g. 201)"
          className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 placeholder-gray-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-3 rounded-lg transition-colors"
        >
          Go
        </button>
      </form>

      <p className="text-gray-600 text-sm mt-6">
        You can also navigate directly to <code className="text-gray-400">/:teamId</code>
      </p>
    </div>
  );
}
