import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import People from './pages/People'
import ArchivedPeople from './pages/ArchivedPeople'
import PersonDetail from './pages/PersonDetail'
import Movimentacoes from './pages/Movimentacoes'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import UpcomingDue from './pages/UpcomingDue'
import SearchPage from './pages/Search'
import BankConnections from './pages/BankConnections'
import { Navigate } from 'react-router-dom'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  return <Navigate to={user ? '/dashboard' : '/inicio'} replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Toaster position="top-center" toastOptions={{ style: { fontSize: '14px' } }} />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/inicio" element={<Landing />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/criar-conta" element={<Signup />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas"
              element={
                <ProtectedRoute>
                  <People />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/arquivadas"
              element={
                <ProtectedRoute>
                  <ArchivedPeople />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pessoas/:id"
              element={
                <ProtectedRoute>
                  <PersonDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movimentacoes"
              element={
                <ProtectedRoute>
                  <Movimentacoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vencimentos"
              element={
                <ProtectedRoute>
                  <UpcomingDue />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analises"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/busca"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-bancarias"
              element={
                <ProtectedRoute>
                  <BankConnections />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
