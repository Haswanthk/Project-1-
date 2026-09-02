import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  delay?: number
  hover?: boolean
  onClick?: () => void
}

export function GlassCard({ children, className = '', delay = 0, hover = true, onClick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={hover ? { y: -2, transition: { duration: 0.2 } } : undefined}
      onClick={onClick}
      className={`glass-card p-5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </motion.div>
  )
}
