import type { PageContext } from '@repo/shared'

interface PageContextBadgeProps {
  context: PageContext
  onClear: () => void
}

export function PageContextBadge({ context, onClear }: PageContextBadgeProps) {
  return (
    <div className="mb-2 flex items-center gap-1">
      <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        <span className="truncate" title={context.url}>
          {context.title || context.url}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded hover:bg-muted-foreground/20"
          aria-label="Remove page context"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </span>
    </div>
  )
}
