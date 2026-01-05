import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

export type NavigationPath = '/chat' | '/boosts' | '/boosts/create'

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

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [path, setPath] = useState<NavigationPath>('/chat')
  const [params, setParams] = useState<Record<string, string> | undefined>()
  const [history, setHistory] = useState<NavigationState[]>([{ path: '/chat' }])

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

