import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="p-4 rounded-2xl bg-[var(--c-bg-secondary)] border border-[var(--c-border)] text-[var(--c-text-muted)] mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-[var(--c-text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--c-text-secondary)] max-w-sm mb-6">{description}</p>
      {action}
    </motion.div>
  )
}
