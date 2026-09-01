import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'

type GlassCardProps = PropsWithChildren<{
  className?: string
}>

export function GlassCard({ children, className = '' }: GlassCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border border-white/10 bg-white/8 p-5 backdrop-blur-xl ${className}`}
    >
      {children}
    </motion.section>
  )
}

