import { GlassCard } from '../components/ui/GlassCard'

type FeaturePageProps = {
  title: string
}

export function FeaturePage({ title }: FeaturePageProps) {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <GlassCard>
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-2xl bg-[var(--c-accent-light)] border border-[var(--c-accent)]/20 text-[var(--c-accent)]">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--c-text-primary)] tracking-tight">{title}</h2>
            <p className="text-sm text-[var(--c-text-secondary)] mt-0.5">
              Enterprise module — connected to platform orchestration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
            <p className="text-xs font-mono text-[var(--c-text-muted)] uppercase tracking-wider mb-1">Status</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Active</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
            <p className="text-xs font-mono text-[var(--c-text-muted)] uppercase tracking-wider mb-1">API Connected</p>
            <p className="text-lg font-bold text-[var(--c-accent)]">Ready</p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)]">
            <p className="text-xs font-mono text-[var(--c-text-muted)] uppercase tracking-wider mb-1">Pipeline</p>
            <p className="text-lg font-bold text-[var(--c-text-primary)]">Orchestrated</p>
          </div>
        </div>

        <p className="text-sm text-[var(--c-text-secondary)] leading-relaxed">
          This module is wired into the enterprise shell and is ready for advanced workflows, API integration, and
          feature expansion. Connect your data sources and configure pipelines to unlock full potential.
        </p>
      </GlassCard>
    </div>
  )
}
