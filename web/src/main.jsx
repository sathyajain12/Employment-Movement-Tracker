import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router.jsx'
import './index.css'

// A 401 anywhere means the session ended: refresh /api/me so the app sends the user to /login.
const onAuthError = (error) => {
  if (error?.status === 401) queryClient.invalidateQueries({ queryKey: ['me'] })
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onAuthError }),
  mutationCache: new MutationCache({ onError: onAuthError }),
  defaultOptions: {
    queries: {
      // Retry only network and server errors; 4xx answers won't change on retry.
      retry: (count, error) => count < 2 && (error?.status === 0 || error?.status >= 500),
      refetchOnWindowFocus: true
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
