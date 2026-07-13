export default function StatCard({
  label, value, hint, icon, accent,
}: { label: string; value: string | number; hint?: string; icon?: React.ReactNode; accent?: string; }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-2xl font-bold mt-1 text-slate-800">{value}</div>
          {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
        </div>
        {icon && (
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ?? "bg-brand-100 text-brand-700"}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
