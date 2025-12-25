import { Button } from '@/components/ui/button'

interface ChatHeaderProps {
  title: string
  onOpenSessions: () => void
  onNewChat: () => void
}

export function ChatHeader({ title, onOpenSessions, onNewChat }: ChatHeaderProps) {
  return (
    <header className="border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Hamburger menu */}
        <button
          onClick={onOpenSessions}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Open conversations"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        {/* Center: Conversation title */}
        <h1 className="flex-1 truncate text-center text-sm font-medium tracking-tight">
          {title}
        </h1>

        {/* Right: New chat button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewChat}
          className="text-xs text-muted-foreground"
          aria-label="New chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </Button>
      </div>
    </header>
  )
}

