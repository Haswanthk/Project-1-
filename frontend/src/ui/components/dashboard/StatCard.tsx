import { GlassCard } from '../ui/GlassCard'

type StatCardProps = {
  title: string
  value: string
  delta: string
}

export function StatCard({ title, value, delta }: StatCardProps) {
  return (
    <GlassCard>
      <p className="text-xs text-slate-300">{title}</p>
      <h3 className="mt-2 text-3xl font-semibold">{value}</h3>
      <p className="mt-1 text-xs text-emerald-300">{delta}</p>
    </GlassCard>
  )
}

