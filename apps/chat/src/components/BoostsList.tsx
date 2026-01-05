import { useBoosts } from '@/hooks/useBoosts'
import { BoostCard } from '@/components/BoostCard'
import { Button } from '@/components/ui/button'
import { useNavigationContext } from '@/contexts/NavigationContext'

export function BoostsList() {
  const { boosts, boostsByDomain, isLoading, toggleBoost, deleteBoost, runBoost } = useBoosts()
  const { navigate } = useNavigationContext()

  const sortedDomains = Object.keys(boostsByDomain).sort()

  const handleCreateBoost = () => {
    navigate('/boosts/create')
  }

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Boosts</h2>
        <Button variant="ghost" size="sm" onClick={handleCreateBoost} className="text-xs">
          + Create
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">Loading boosts...</p>
          </div>
        ) : boosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No boosts yet. Create one to enhance your browsing experience.
            </p>
            <Button variant="ghost" size="sm" onClick={handleCreateBoost} className="mt-4 text-xs">
              Create Boost
            </Button>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {sortedDomains.map((domain) => (
              <div key={domain}>
                {/* Domain header */}
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {domain}
                </h3>
                {/* Boosts for this domain */}
                <div className="space-y-2">
                  {boostsByDomain[domain].map((boost) => (
                    <BoostCard
                      key={boost.id}
                      boost={boost}
                      onToggle={toggleBoost}
                      onDelete={deleteBoost}
                      onRun={runBoost}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

