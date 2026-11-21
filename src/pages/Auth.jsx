import { Link, useNavigate, useLocation } from 'react-router-dom';
import FormBuilder from '../components/FormBuilder';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

const AuthCard = ({ title, children }) => (
  <div className="auth-bg d-flex align-items-center justify-content-center p-3">
    <div className="card p-4" style={{ width: '100%', maxWidth: 480 }}>
      <div className="text-center mb-3">
        <i className="bi bi-hexagon-half fs-1 text-primary" />
        <h1 className="h4 mb-0">AcxiomCRM</h1>
        <div className="text-muted">{title}</div>
      </div>
      {children}
    </div>
  </div>
);

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <AuthCard title="Sign in to continue">
      <FormBuilder
        submitLabel="Login"
        fields={[
          { name: 'login', label: 'Username or Email', required: true, maxLength: 254, col: 'col-12', autoComplete: 'username' },
          { name: 'password', label: 'Password', type: 'password', required: true, col: 'col-12', autoComplete: 'current-password' }
        ]}
        onSubmit={async (v) => {
          const u = await login(v.login, v.password);
          nav(u.mustChangePassword ? '/change-password' : (loc.state?.from || '/'), { replace: true });
        }}
      />
      <div className="mt-3 text-center small">New user? <Link to="/register">Create an account</Link></div>
      <div className="mt-2 text-center small text-muted">Demo: admin / neha.manager / rahul.sales — password <code>Acxiom@2026</code></div>
    </AuthCard>
  );
}

export const passwordHelp = 'Min 8 characters with uppercase, lowercase, digit and special character.';

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  return (
    <AuthCard title="Create your account">
      <FormBuilder
        submitLabel="Register"
        fields={[
          { name: 'name', label: 'Full Name', required: true, minLength: 2, maxLength: 100, col: 'col-12' },
          { name: 'username', label: 'Username', required: true, minLength: 3, maxLength: 30, custom: (v) => (/^[a-zA-Z0-9._-]+$/.test(v) ? null : 'Username may contain only letters, digits, dot, underscore and hyphen.') },
          { name: 'phone', label: 'Phone', phone: true, maxLength: 10 },
          { name: 'email', label: 'Email', required: true, email: true, maxLength: 254, col: 'col-12' },
          { name: 'password', label: 'Password', type: 'password', required: true, password: true, help: passwordHelp, autoComplete: 'new-password' },
          { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true, match: 'password', autoComplete: 'new-password' }
        ]}
        onSubmit={async (v) => { await register(v); toast('Welcome to AcxiomCRM!'); nav('/'); }}
      />
      <div className="mt-3 text-center small">Already registered? <Link to="/login">Sign in</Link></div>
    </AuthCard>
  );
}

export function ChangePassword() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  return (
    <div className="container py-4" style={{ maxWidth: 560 }}>
      <div className="card p-4">
        <h1 className="h5">Change Password</h1>
        {user?.mustChangePassword && <div className="alert alert-warning py-2">Your administrator issued a temporary password. Please set a new password to continue.</div>}
        <FormBuilder
          submitLabel="Change Password"
          onCancel={user?.mustChangePassword ? undefined : () => nav(-1)}
          fields={[
            { name: 'currentPassword', label: 'Current Password', type: 'password', required: true, col: 'col-12', autoComplete: 'current-password' },
            { name: 'newPassword', label: 'New Password', type: 'password', required: true, password: true, help: passwordHelp, col: 'col-12', autoComplete: 'new-password' },
            { name: 'confirmPassword', label: 'Confirm New Password', type: 'password', required: true, match: 'newPassword', col: 'col-12', autoComplete: 'new-password' }
          ]}
          onSubmit={async (v) => { await api.post('/auth/change-password', v); await refresh(); toast('Password changed successfully.'); nav('/'); }}
        />
      </div>
    </div>
  );
}
