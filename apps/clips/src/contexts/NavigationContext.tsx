import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

export type NavigationPath = '/clips' | '/viewer'

export interface NavigationState {
  path: NavigationPath
  params?: Record<string, string>
}

export interface NavigationContextValue {
  path: NavigationPath
  params?: Record<string, string>
  navigate: (path: NavigationPath, params?: Record<string, string>) => void
  goBack: () => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function useNavigationContext() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider')
  }
  return context
}

interface NavigationProviderProps {
  children: ReactNode
}

function getInitialNavigationState(): NavigationState {
  // Check URL params for ?id=<clipId> to open viewer directly
  const urlParams = new URLSearchParams(window.location.search)
  const clipId = urlParams.get('id')
  if (clipId) {
    return { path: '/viewer', params: { clipId } }
  }
  return { path: '/clips' }
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const initialState = getInitialNavigationState()
  const [path, setPath] = useState<NavigationPath>(initialState.path)
  const [params, setParams] = useState<Record<string, string> | undefined>(initialState.params)
  const [history, setHistory] = useState<NavigationState[]>([initialState])

  const navigate = useCallback(
    (newPath: NavigationPath, newParams?: Record<string, string>) => {
      setHistory((prev) => [...prev, { path: newPath, params: newParams }])
      setPath(newPath)
      setParams(newParams)
    },
    []
  )

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev
      const newHistory = prev.slice(0, -1)
      const previousState = newHistory[newHistory.length - 1]
      setPath(previousState.path)
      setParams(previousState.params)
      return newHistory
    })
  }, [])

  const value: NavigationContextValue = {
    path,
    params,
    navigate,
    goBack,
  }

  return (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
  )
}

