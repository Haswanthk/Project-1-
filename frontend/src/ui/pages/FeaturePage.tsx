import { GlassCard } from '../components/ui/GlassCard'

type FeaturePageProps = {
  title: string
}

export function FeaturePage({ title }: FeaturePageProps) {
  return (
    <GlassCard>
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-slate-300">
        This module is wired into the enterprise shell and is ready for advanced workflows, API integration, and
        feature expansion.
      </p>
    </GlassCard>
  )
}

