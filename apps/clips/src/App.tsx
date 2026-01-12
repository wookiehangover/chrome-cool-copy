import { NavigationProvider, useNavigationContext } from '@/contexts/NavigationContext'
import { ClipsList } from '@/components/ClipsList'
import { ClipViewer } from '@/components/ClipViewer'

function ClipsContent() {
  const { path } = useNavigationContext()

  // Render based on current path
  if (path === '/clips') {
    return (
      <div className="flex h-screen w-full flex-col bg-background text-foreground">
        <ClipsList />
      </div>
    )
  }

  if (path === '/viewer') {
    return <ClipViewer />
  }

  // Default view
  return (
    <div className="flex h-screen w-full flex-col bg-background text-foreground">
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Clips App</h1>
          <p className="text-muted-foreground">Current path: {path}</p>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <NavigationProvider>
      <ClipsContent />
    </NavigationProvider>
  )
}

export default App

