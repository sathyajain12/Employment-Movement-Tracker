import { createBrowserRouter } from 'react-router'
import { AdminOnly, AuthGate, HomeRedirect, NotFound, RouteError } from './App.jsx'
import { Layout } from './components/Layout.jsx'
import Dashboard from './pages/admin/Dashboard.jsx'
import Monthly from './pages/admin/Monthly.jsx'
import Register from './pages/admin/Register.jsx'
import Review from './pages/admin/Review.jsx'
import Settings from './pages/admin/Settings.jsx'
import Staff from './pages/admin/Staff.jsx'
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
          {
            path: 'admin',
            element: <AdminOnly />,
            children: [
              { index: true, element: <Dashboard /> },
              { path: 'review', element: <Review /> },
              { path: 'register', element: <Register /> },
              { path: 'monthly', element: <Monthly /> },
              { path: 'staff', element: <Staff /> },
              { path: 'settings', element: <Settings /> }
            ]
          },
          { path: '*', element: <NotFound /> }
        ]
      }
    ]
  }
])
