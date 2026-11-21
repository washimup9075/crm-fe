import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { fmtDateTime } from '../utils/api';

// Menu items are shown according to the logged-in user's permissions (server still enforces).
const MENU = [
  { to: '/', label: 'Dashboard', icon: 'speedometer2', perm: 'dashboard:view', end: true },
  { to: '/customers', label: 'Customers', icon: 'people', perm: 'customers:read' },
  { to: '/leads', label: 'Leads', icon: 'funnel', perm: 'leads:read' },
  { to: '/opportunities', label: 'Opportunities', icon: 'briefcase', perm: 'opportunities:read' },
  { to: '/pipeline', label: 'Sales Pipeline', icon: 'kanban', perm: 'opportunities:read' },
  { to: '/followups', label: 'Follow-Ups', icon: 'calendar-check', perm: 'followups:read' },
  { to: '/activities', label: 'Activities', icon: 'activity', perm: 'activities:read' },
  { to: '/reports', label: 'Reports', icon: 'bar-chart', perm: ['reports:view', 'audit:read'] },
  { header: 'Administration', perm: ['users:read', 'users:manage', 'roles:manage', 'audit:read'] },
  { to: '/users', label: 'Users', icon: 'person-gear', perm: ['users:read', 'users:manage'] },
  { to: '/roles', label: 'Roles & Permissions', icon: 'shield-lock', perm: ['roles:manage', 'users:read'] },
  { to: '/audit', label: 'Audit Log', icon: 'journal-text', perm: 'audit:read' }
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const nav = useNavigate();
  const box = useRef();
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return undefined; }
    const t = setTimeout(() => api.get('/search', { params: { q } }).then((r) => setRes(r.data.data)).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setRes(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  const go = (path) => { setQ(''); setRes(null); nav(path); };
  const groups = res ? [['Customers', res.customers, '/customers'], ['Leads', res.leads, '/leads'], ['Opportunities', res.opportunities, '/opportunities']] : [];
  return (
    <div className="position-relative flex-grow-1 me-3" style={{ maxWidth: 420 }} ref={box}>
      <input className="form-control form-control-sm" type="search" placeholder="Search customers, leads, opportunities…" aria-label="Global search" value={q} onChange={(e) => setQ(e.target.value)} />
      {res && (
        <div className="list-group position-absolute w-100 shadow mt-1" style={{ zIndex: 1050 }}>
          {groups.every(([, items]) => !items.length) && <div className="list-group-item small text-muted">No matches</div>}
          {groups.map(([label, items, base]) => items.length > 0 && (
            <div key={label}>
              <div className="list-group-item small fw-bold bg-light">{label}</div>
              {items.map((i) => (
                <button key={i.id} className="list-group-item list-group-item-action small" onClick={() => go(`${base}/${i.id}`)}>
                  {i.title}<div className="text-muted">{i.subtitle}</div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { can } = useAuth();
  const [n, setN] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!can('followups:read')) return undefined;
    const load = () => api.get('/notifications').then((r) => setN(r.data.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [can]);
  if (!n) return null;
  const count = n.overdue + n.dueToday;
  return (
    <div className="dropdown me-2">
      <button className="btn btn-sm btn-outline-secondary position-relative" aria-label={`${count} notifications`} onClick={() => setOpen(!open)}>
        <i className="bi bi-bell" />
        {count > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{count}</span>}
      </button>
      {open && (
        <div className="dropdown-menu dropdown-menu-end show shadow p-0" style={{ width: 320, right: 0, left: 'auto' }}>
          <div className="px-3 py-2 border-bottom small"><strong>{n.overdue}</strong> overdue · <strong>{n.dueToday}</strong> due today</div>
          {n.items.length === 0 && <div className="px-3 py-2 small text-muted">No pending follow-ups.</div>}
          {n.items.map((f) => (
            <Link key={f.id} to="/followups" className="dropdown-item small" onClick={() => setOpen(false)}>
              <div className="d-flex justify-content-between"><span className="text-truncate">{f.subject}</span>{f.isOverdue && <span className="badge text-bg-danger">Overdue</span>}</div>
              <div className="text-muted">{fmtDateTime(f.followUpDate)} · {f.relatedName}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const allowed = (perm) => (Array.isArray(perm) ? can(...perm) : can(perm));

  return (
    <div className="d-flex min-vh-100">
      <aside className={`sidebar bg-dark text-white ${sidebar ? 'open' : ''}`}>
        <div className="p-3 border-bottom border-secondary d-flex align-items-center">
          <i className="bi bi-hexagon-half fs-4 text-info me-2" /><span className="fs-5 fw-semibold">AcxiomCRM</span>
        </div>
        <nav className="nav flex-column p-2" aria-label="Main navigation">
          {MENU.filter((m) => allowed(m.perm)).map((m) => (m.header
            ? <div key={m.header} className="text-uppercase small text-secondary mt-3 mb-1 px-2">{m.header}</div>
            : (
              <NavLink key={m.to} to={m.to} end={m.end} onClick={() => setSidebar(false)} className={({ isActive }) => `nav-link text-white rounded px-2 py-2 ${isActive ? 'bg-primary' : 'opacity-75'}`}>
                <i className={`bi bi-${m.icon} me-2`} />{m.label}
              </NavLink>
            )))}
        </nav>
      </aside>
      <div className="flex-grow-1 d-flex flex-column main-area">
        <header className="navbar bg-white border-bottom px-3 sticky-top">
          <button className="btn btn-sm btn-outline-secondary d-lg-none me-2" aria-label="Toggle menu" onClick={() => setSidebar(!sidebar)}><i className="bi bi-list" /></button>
          <GlobalSearch />
          <div className="d-flex align-items-center ms-auto">
            <Notifications />
            <div className="dropdown">
              <button className="btn btn-sm btn-light dropdown-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
                <i className="bi bi-person-circle me-1" />{user.name} <span className="badge text-bg-secondary ms-1">{user.role}</span>
              </button>
              {menuOpen && (
                <ul className="dropdown-menu dropdown-menu-end show" style={{ right: 0, left: 'auto' }}>
                  <li><span className="dropdown-item-text small text-muted">{user.email}</span></li>
                  <li><Link className="dropdown-item" to="/change-password" onClick={() => setMenuOpen(false)}><i className="bi bi-key me-2" />Change Password</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><button className="dropdown-item text-danger" onClick={async () => { await logout(); nav('/login'); }}><i className="bi bi-box-arrow-right me-2" />Logout</button></li>
                </ul>
              )}
            </div>
          </div>
        </header>
        <main className="p-3 p-md-4 flex-grow-1"><Outlet /></main>
        <footer className="border-top bg-white small text-muted px-4 py-2 d-flex justify-content-between">
          <span>© {new Date().getFullYear()} AcxiomCRM</span><span>Signed in as {user.username} · {user.role}</span>
        </footer>
      </div>
    </div>
  );
}
