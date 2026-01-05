import { useNavigationContext } from '@/contexts/NavigationContext'
import { Button } from '@/components/ui/button'

export function Navigation() {
  const { path, navigate, goBack } = useNavigationContext()

  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2">
      {path !== '/chat' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="text-xs"
        >
          ← Back
        </Button>
      )}
      <div className="flex-1" />
      <div className="flex gap-1">
        <Button
          variant={path === '/chat' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => navigate('/chat')}
          className="text-xs"
        >
          Chat
        </Button>
        <Button
          variant={path === '/boosts' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => navigate('/boosts')}
          className="text-xs"
        >
          Boosts
        </Button>
        <Button
          variant={path === '/boosts/create' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => navigate('/boosts/create')}
          className="text-xs"
        >
          Create
        </Button>
      </div>
    </div>
  )
}

