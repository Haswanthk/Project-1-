import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, icon, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
    >
      <div className="flex items-center gap-4">
        {icon && (
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/20 text-indigo-400">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--c-text-primary)] tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--c-text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  )
}
