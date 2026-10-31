import { createBrowserRouter } from 'react-router'
import { AuthGate, HomeRedirect, NotFound, RouteError } from './App.jsx'
import { Layout } from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import History from './pages/staff/History.jsx'
import StaffHome from './pages/staff/Home.jsx'

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
          { path: 'home', element: <StaffHome /> },
          { path: 'history', element: <History /> },
          { path: '*', element: <NotFound /> }
        ]
      }
    ]
  }
])
