interface EmptyStateProps {
  strategy: string
}

export function EmptyState({ strategy }: EmptyStateProps) {
  return (
    <div className="aspect-video border border-border rounded-md grid place-items-center mt-20">
      <p className="text-sm text-muted-foreground text-balance whitespace-pre-wrap">
        {strategy}
      </p>
    </div>
  )
}

