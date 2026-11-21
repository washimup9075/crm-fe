import { useState } from 'react';
import api, { fmtDateTime, parseError, toInputDateTime } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, useLookup, PageHeader, DateRangeFilter } from '../components/ui';

const ICON = { Call: 'telephone', Meeting: 'people', Email: 'envelope', Task: 'check2-square' };

function ActivityForm({ act, onDone, onCancel }) {
  const { meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const customers = useLookup('/customers/lookup');
  const leads = useLookup('/leads/lookup');
  const fields = [
    { name: 'activityType', label: 'Activity Type', type: 'select', required: true, options: meta?.activityTypes || [], col: 'col-md-4' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: meta?.activityStatuses || [], col: 'col-md-4' },
    { name: 'activityDate', label: 'Activity Date & Time', type: 'datetime-local', required: true, col: 'col-md-4' },
    { name: 'subject', label: 'Subject', required: true, minLength: 2, maxLength: 150, col: 'col-12' },
    { name: 'customerId', label: 'Customer', type: 'select', options: customers.map((c) => ({ value: c.id, label: c.name })), custom: (v, all) => (!v && !all.leadId ? 'Link the activity to a customer or a lead.' : null) },
    { name: 'leadId', label: 'Lead', type: 'select', options: leads.map((l) => ({ value: l.id, label: l.name })) },
    { name: 'assignedToId', label: 'Assigned User', type: 'select', options: users.map((u) => ({ value: u.id, label: u.name })), placeholder: 'Me' },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000, col: 'col-12' }
  ];
  const initial = act
    ? { ...act, customerId: act.customer?.id || '', leadId: act.lead?.id || '', assignedToId: act.assignedTo?.id, activityDate: toInputDateTime(act.activityDate) }
    : { activityType: 'Call', status: 'Completed', activityDate: toInputDateTime(new Date()) };
  return (
    <FormBuilder fields={fields} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
      const body = { ...v, activityDate: new Date(v.activityDate).toISOString() };
      const r = act ? await api.put(`/activities/${act.id}`, body) : await api.post('/activities', body);
      toast(r.data.message); onDone();
    }} />
  );
}

export default function Activities() {
  const { can, meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const list = useList('/activities', { activityType: '', status: '', assignedToId: '', search: '', range: '', from: '', to: '' }, '-activityDate');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = list.filters;
  return (
    <>
      <PageHeader title="Activity Management" icon="activity">
        {can('activities:create') && <button className="btn btn-primary" onClick={() => setEdit({})}><i className="bi bi-plus-lg me-1" />Log Activity</button>}
      </PageHeader>
      <ul className="nav nav-pills mb-3">
        {[['', 'All'], ['Call', 'Calls'], ['Meeting', 'Meetings'], ['Email', 'Emails'], ['Task', 'Tasks']].map(([k, l]) => (
          <li key={k} className="nav-item"><button className={`nav-link ${f.activityType === k ? 'active' : ''}`} onClick={() => list.setFilter('activityType', k)}>{k && <i className={`bi bi-${ICON[k]} me-1`} />}{l}</button></li>
        ))}
      </ul>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Search subject" aria-label="Search subject" value={f.search} onChange={(e) => list.setFilter('search', e.target.value)} /></div>
          <DateRangeFilter filters={f} setFilter={list.setFilter} />
          <div className="col-auto"><select className="form-select form-select-sm" aria-label="Status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All statuses</option>{meta?.activityStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
          {users.length > 1 && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Assigned user" value={f.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)}><option value="">All users</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
        </div>
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><Th field="activityDate" label="Date" {...list} /><Th field="activityType" label="Type" {...list} /><Th field="subject" label="Subject" {...list} /><Th label="Related" /><Th field="status" label="Status" {...list} /><Th label="Assigned To" /><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {list.items.map((a) => (
              <tr key={a.id}>
                <td className="text-nowrap">{fmtDateTime(a.activityDate)}</td><td><i className={`bi bi-${ICON[a.activityType]} me-1`} />{a.activityType}</td>
                <td>{a.subject}<div className="small text-muted text-truncate" style={{ maxWidth: 300 }}>{a.description}</div></td>
                <td>{a.customer?.name || a.lead?.name}</td><td><Badge value={a.status} /></td><td>{a.assignedTo?.name}</td>
                <td className="text-end text-nowrap">
                  {can('activities:update') && <button className="btn btn-sm btn-outline-primary me-1" aria-label="Edit" onClick={() => setEdit(a)}><i className="bi bi-pencil" /></button>}
                  {can('activities:delete') && <button className="btn btn-sm btn-outline-danger" aria-label="Delete" onClick={() => setDel(a)}><i className="bi bi-trash" /></button>}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No activities.</td></tr>}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>
      {edit && <Modal title={edit.id ? 'Edit Activity' : 'Log Activity'} onClose={() => setEdit(null)}><ActivityForm act={edit.id ? edit : null} onCancel={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} /></Modal>}
      {del && <Confirm message={`Delete activity "${del.subject}"?`} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.delete(`/activities/${del.id}`); toast('Activity deleted.'); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); }
        setDel(null);
      }} />}
    </>
  );
}
