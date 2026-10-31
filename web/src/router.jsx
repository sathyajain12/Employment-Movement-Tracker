import { createBrowserRouter } from 'react-router'
import { AuthGate, HomeRedirect, NotFound, RouteError } from './App.jsx'
import { Layout } from './components/Layout.jsx'
import Login from './pages/Login.jsx'

export const router = createBrowserRouter([
  { path: '/login', element: <Login />, errorElement: <RouteError /> },
  {
    element: <AuthGate />,
    errorElement: <RouteError />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: '*', element: <NotFound /> }
        ]
      }
    ]
  }
])
