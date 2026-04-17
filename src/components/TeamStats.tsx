interface Props {
  stats: Record<string, string>;
}

export default function TeamStats({ stats }: Props) {
  const entries = Object.entries(stats);

  if (entries.length === 0) {
    return <p className="text-gray-400 py-8 text-center">No team stats available.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
      {entries.map(([label, value]) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex justify-between items-center">
          <span className="text-gray-400 text-sm">{label}</span>
          <span className="text-white font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
}
