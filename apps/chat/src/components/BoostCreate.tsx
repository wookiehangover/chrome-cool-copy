import { useNavigationContext } from '@/contexts/NavigationContext'

export function BoostCreate() {
  const { params } = useNavigationContext()

  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Create Boost</h2>
          <p className="text-sm text-muted-foreground">Boost authoring flow coming soon</p>
          {params?.domain && (
            <p className="mt-2 text-xs text-muted-foreground">Domain: {params.domain}</p>
          )}
        </div>
      </div>
    </div>
  )
}

