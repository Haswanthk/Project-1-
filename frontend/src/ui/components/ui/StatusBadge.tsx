type Variant = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral'

const variantClasses: Record<Variant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error:   'badge-error',
  info:    'badge-info',
  accent:  'badge-accent',
  neutral: 'badge-neutral',
}

type Props = {
  label: string
  variant?: Variant
  dot?: boolean
  className?: string
}

export function StatusBadge({ label, variant = 'neutral', dot = false, className = '' }: Props) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {dot && (
        <span
          className="size-1.5 rounded-full"
          style={{
            background: 'currentColor',
            animation: variant === 'success' || variant === 'error' ? 'pulse 2s infinite' : 'none',
          }}
        />
      )}
      {label}
    </span>
  )
}
