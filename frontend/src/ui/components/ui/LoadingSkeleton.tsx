type Props = {
  lines?: number
  className?: string
}

export function LoadingSkeleton({ lines = 3, className = '' }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton rounded-lg"
          style={{
            height: i === 0 ? '1.5rem' : '1rem',
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  )
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton h-32 rounded-xl" />
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="skeleton h-10 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-14 rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = '300px' }: { height?: string }) {
  return <div className="skeleton rounded-xl" style={{ height }} />
}
