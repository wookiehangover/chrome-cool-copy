import { useNavigationContext } from '@/contexts/NavigationContext'
import { Button } from '@/components/ui/button'

export function Navigation() {
  const { path, navigate } = useNavigationContext()

  return (
    <div className="flex items-center justify-end gap-1 border-b border-border px-4 py-2">
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

