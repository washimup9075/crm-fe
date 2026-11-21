import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { Login, Register, ChangePassword } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import { CustomerList, CustomerDetails } from './pages/Customers';
import { LeadList, LeadDetails } from './pages/Leads';
import { OpportunityList, OpportunityDetails, Pipeline } from './pages/Opportunities';
import FollowUps from './pages/FollowUps';
import Activities from './pages/Activities';
import { Users, Roles } from './pages/Admin';
import AuditLog from './pages/AuditLog';
import Reports from './pages/Reports';

/** Access control: anonymous users are redirected to Login; missing permission shows 403. */
function Protected({ perm, children }) {
  const { user, loading, can } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.mustChangePassword && loc.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  if (perm && !(Array.isArray(perm) ? can(...perm) : can(perm))) return <Forbidden />;
  return children;
}

const Forbidden = () => (
  <div className="text-center py-5"><i className="bi bi-shield-x display-4 text-danger" /><h2 className="h4 mt-3">Access denied</h2><p className="text-muted">You do not have permission to view this page.</p></div>
);
const NotFound = () => <div className="text-center py-5"><h2 className="h4">Page not found</h2></div>;

function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/change-password" element={<Protected><ChangePassword /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Protected perm="dashboard:view"><Dashboard /></Protected>} />
        <Route path="customers" element={<Protected perm="customers:read"><CustomerList /></Protected>} />
        <Route path="customers/:id" element={<Protected perm="customers:read"><CustomerDetails /></Protected>} />
        <Route path="leads" element={<Protected perm="leads:read"><LeadList /></Protected>} />
        <Route path="leads/:id" element={<Protected perm="leads:read"><LeadDetails /></Protected>} />
        <Route path="opportunities" element={<Protected perm="opportunities:read"><OpportunityList /></Protected>} />
        <Route path="opportunities/:id" element={<Protected perm="opportunities:read"><OpportunityDetails /></Protected>} />
        <Route path="pipeline" element={<Protected perm="opportunities:read"><Pipeline /></Protected>} />
        <Route path="followups" element={<Protected perm="followups:read"><FollowUps /></Protected>} />
        <Route path="activities" element={<Protected perm="activities:read"><Activities /></Protected>} />
        <Route path="reports" element={<Protected perm={['reports:view', 'audit:read']}><Reports /></Protected>} />
        <Route path="users" element={<Protected perm={['users:read', 'users:manage']}><Users /></Protected>} />
        <Route path="roles" element={<Protected perm={['roles:manage', 'users:read']}><Roles /></Protected>} />
        <Route path="audit" element={<Protected perm="audit:read"><AuditLog /></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider><App /></AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
