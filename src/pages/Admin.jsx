import { useState, useEffect } from 'react';
import api, { fmtDateTime, parseError } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, PageHeader, Loading } from '../components/ui';
import { passwordHelp } from './Auth';

function UserForm({ user, onDone, onCancel }) {
  const { meta } = useAuth();
  const toast = useToast();
  const [managers, setManagers] = useState([]);
  useEffect(() => { api.get('/users', { params: { role: 'Manager', status: 'active', limit: 100 } }).then((r) => setManagers(r.data.data)); }, []);
  const fields = [
    { name: 'name', label: 'Full Name', required: true, minLength: 2, maxLength: 100 },
    { name: 'username', label: 'Username', required: true, minLength: 3, maxLength: 30, disabled: !!user },
    { name: 'email', label: 'Email', required: true, email: true },
    { name: 'phone', label: 'Phone', phone: true, maxLength: 10 },
    { name: 'role', label: 'Role', type: 'select', required: true, options: meta?.roles || [] },
    { name: 'managerId', label: 'Reports to (Manager)', type: 'select', options: managers.map((m) => ({ value: m.id, label: m.name })), hidden: (v) => v.role !== 'SalesExecutive', placeholder: 'No manager' },
    ...(user ? [] : [{ name: 'password', label: 'Temporary Password', type: 'password', required: true, password: true, help: `${passwordHelp} User must change it at first login.`, autoComplete: 'new-password' }])
  ];
  const initial = user ? { ...user, managerId: user.manager?.id || '' } : { role: 'SalesExecutive', isActive: true };
  return (
    <FormBuilder fields={fields} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
      const body = { ...v };
      if (body.role !== 'SalesExecutive') body.managerId = '';
      if (user) { delete body.username; }
      const r = user ? await api.put(`/users/${user.id}`, body) : await api.post('/users', body);
      toast(r.data.message); onDone();
    }} />
  );
}

export function Users() {
  const { can, user: me, meta } = useAuth();
  const toast = useToast();
  const manage = can('users:manage');
  const list = useList('/users', { search: '', role: '', status: '' }, 'name');
  const [modal, setModal] = useState(null);
  const f = list.filters;
  const close = () => setModal(null);
  const done = () => { setModal(null); list.reload(); };
  const act = async (fn, msg) => { try { await fn(); toast(msg); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); } };

  return (
    <>
      <PageHeader title="User Management" icon="person-gear">
        {manage && <button className="btn btn-primary" onClick={() => setModal({ type: 'form' })}><i className="bi bi-person-plus me-1" />New User</button>}
      </PageHeader>
      {!manage && <div className="alert alert-info py-2">View-only: you can see members of your team.</div>}
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-4"><input className="form-control form-control-sm" placeholder="Search name, username, email" aria-label="Search users" value={f.search} onChange={(e) => list.setFilter('search', e.target.value)} /></div>
          <div className="col-md-3"><select className="form-select form-select-sm" aria-label="Role" value={f.role} onChange={(e) => list.setFilter('role', e.target.value)}><option value="">All roles</option>{meta?.roles.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="col-md-3"><select className="form-select form-select-sm" aria-label="Account status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="locked">Locked out</option></select></div>
        </div>
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><Th field="name" label="Name" {...list} /><Th field="username" label="Username" {...list} /><Th field="email" label="Email" {...list} /><Th label="Role" /><Th label="Manager" /><Th label="Status" /><Th label="Lockout" /><Th field="lastLoginAt" label="Last Login" {...list} />{manage && <th className="text-end">Actions</th>}</tr></thead>
          <tbody>
            {list.items.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td>{u.username}</td><td>{u.email}</td><td><Badge value={u.role} /></td><td>{u.manager?.name}</td>
                <td>{u.isActive ? <span className="badge text-bg-success">Active</span> : <span className="badge text-bg-secondary">Inactive</span>}{u.mustChangePassword && <span className="badge text-bg-warning ms-1">Temp password</span>}</td>
                <td>{u.isLockedOut ? <span className="badge text-bg-danger" title={`Until ${fmtDateTime(u.lockoutEnd)}`}>Locked</span> : <small className="text-muted">{u.failedLoginCount} failed</small>}</td>
                <td>{fmtDateTime(u.lastLoginAt)}</td>
                {manage && <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" title="Edit / change role" onClick={() => setModal({ type: 'form', u })}><i className="bi bi-pencil" /></button>
                  <button className="btn btn-sm btn-outline-secondary me-1" title="Reset password" onClick={() => setModal({ type: 'reset', u })}><i className="bi bi-key" /></button>
                  {u.isLockedOut && <button className="btn btn-sm btn-outline-warning me-1" title="Unlock" onClick={() => act(() => api.post(`/users/${u.id}/unlock`), 'Account unlocked.')}><i className="bi bi-unlock" /></button>}
                  {u.id !== me.id && <button className={`btn btn-sm ${u.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`} title={u.isActive ? 'Deactivate' : 'Activate'} onClick={() => setModal({ type: 'status', u })}><i className={`bi bi-${u.isActive ? 'person-x' : 'person-check'}`} /></button>}
                </td>}
              </tr>
            ))}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>
      {modal?.type === 'form' && <Modal title={modal.u ? `Edit ${modal.u.name}` : 'New User'} onClose={close}><UserForm user={modal.u} onCancel={close} onDone={done} /></Modal>}
      {modal?.type === 'reset' && <Modal title={`Reset password – ${modal.u.name}`} onClose={close} size="md">
        <FormBuilder submitLabel="Set Temporary Password" onCancel={close} fields={[
          { name: 'newPassword', label: 'Temporary Password', type: 'password', required: true, password: true, help: passwordHelp, col: 'col-12', autoComplete: 'new-password' },
          { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true, match: 'newPassword', col: 'col-12', autoComplete: 'new-password' }]}
          onSubmit={async (v) => { const r = await api.post(`/users/${modal.u.id}/reset-password`, v); toast(r.data.message); done(); }} />
      </Modal>}
      {modal?.type === 'status' && <Confirm title={modal.u.isActive ? 'Deactivate user' : 'Activate user'} confirmLabel={modal.u.isActive ? 'Deactivate' : 'Activate'} variant={modal.u.isActive ? 'danger' : 'success'}
        message={`${modal.u.isActive ? 'Deactivate' : 'Activate'} ${modal.u.name}? ${modal.u.isActive ? 'Their active sessions will end immediately.' : ''}`}
        onClose={close} onConfirm={async () => { await act(() => api.patch(`/users/${modal.u.id}/status`, { isActive: !modal.u.isActive }), 'User status updated.'); close(); }} />}
    </>
  );
}

export function Roles() {
  const { can } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const editable = can('roles:manage');
  const load = () => api.get('/roles').then((r) => {
    setData(r.data);
    setDraft(Object.fromEntries(r.data.data.map((x) => [x.id, [...x.permissions]])));
  });
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;
  const roles = data.data;
  const modules = [...new Set(data.permissions.map((p) => p.module))];
  const toggle = (roleId, key) => setDraft((d) => ({ ...d, [roleId]: d[roleId].includes(key) ? d[roleId].filter((k) => k !== key) : [...d[roleId], key] }));
  const save = async (role) => {
    try { const r = await api.put(`/roles/${role.id}/permissions`, { permissions: draft[role.id] }); toast(r.data.message); load(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };

  return (
    <>
      <PageHeader title="Roles & Permissions" icon="shield-lock" />
      <div className="row g-3 mb-3">
        {roles.map((r) => (
          <div key={r.id} className="col-md-4"><div className="card h-100"><div className="card-body">
            <h2 className="h6"><Badge value={r.roleName} /> <small className="text-muted">({r.userCount} users)</small></h2>
            <p className="small mb-1">{r.description}</p>
            <small className="text-muted">Data scope: <strong>{{ all: 'All records', team: 'Team records', own: 'Own / assigned records' }[r.scope]}</strong></small>
          </div></div></div>
        ))}
      </div>
      <div className="card"><div className="card-body">
        <h2 className="h6">Permission Matrix</h2>
        {!editable && <p className="small text-muted">Read-only. Only Admin can change permissions.</p>}
        <div className="table-responsive"><table className="table table-sm table-bordered align-middle">
          <thead className="table-light"><tr><th>Module</th><th>Permission</th>{roles.map((r) => <th key={r.id} className="text-center">{r.roleName}</th>)}</tr></thead>
          <tbody>
            {modules.map((m) => data.permissions.filter((p) => p.module === m).map((p, i) => (
              <tr key={p.key}>
                {i === 0 && <td rowSpan={data.permissions.filter((x) => x.module === m).length} className="text-capitalize fw-medium">{m}</td>}
                <td>{p.label} <code className="small text-muted">{p.key}</code></td>
                {roles.map((r) => (
                  <td key={r.id} className="text-center">
                    <input type="checkbox" className="form-check-input" aria-label={`${r.roleName} ${p.key}`} checked={draft[r.id]?.includes(p.key)}
                      disabled={!editable || r.roleName === 'Admin'} onChange={() => toggle(r.id, p.key)} />
                  </td>
                ))}
              </tr>
            )))}
          </tbody>
          {editable && <tfoot><tr><td colSpan="2" /><td className="text-center text-muted small">Always full</td>{roles.filter((r) => r.roleName !== 'Admin').map((r) => <td key={r.id} className="text-center"><button className="btn btn-sm btn-primary" onClick={() => save(r)}>Save</button></td>)}</tr></tfoot>}
        </table></div>
      </div></div>
    </>
  );
}
