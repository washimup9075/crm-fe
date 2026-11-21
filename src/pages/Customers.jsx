import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { fmtDate, fmtMoney, fmtDateTime, parseError } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, useLookup, PageHeader, Loading, Detail, DateRangeFilter } from '../components/ui';
import { AuditTable, HistoryTimeline } from './shared';

export function customerFields(meta, users) {
  return [
    { name: 'customerName', label: 'Customer Name', required: true, minLength: 2, maxLength: 100 },
    { name: 'companyName', label: 'Company Name', maxLength: 150 },
    { name: 'email', label: 'Email', required: true, email: true, maxLength: 254 },
    { name: 'phone', label: 'Phone', required: true, phone: true, maxLength: 10, help: '10-digit Indian mobile number' },
    { name: 'address', label: 'Address', maxLength: 250, col: 'col-12' },
    { name: 'city', label: 'City', maxLength: 60, col: 'col-md-4' },
    { name: 'state', label: 'State', maxLength: 60, col: 'col-md-4' },
    { name: 'status', label: 'Status', type: 'select', required: true, options: meta?.customerStatuses || [], col: 'col-md-4' },
    { name: 'ownerId', label: 'Assigned Sales Executive', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })), placeholder: 'Me' },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, col: 'col-12' }
  ];
}

export function CustomerForm({ customer, onDone, onCancel }) {
  const { meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const initial = customer ? { ...customer, ownerId: customer.owner?.id } : { status: 'Active' };
  return (
    <FormBuilder fields={customerFields(meta, users)} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
      const r = customer ? await api.put(`/customers/${customer.id}`, v) : await api.post('/customers', v);
      toast(r.data.message);
      onDone(r.data.data);
    }} />
  );
}

export function CustomerList() {
  const { can, meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const list = useList('/customers', { search: '', customerName: '', email: '', phone: '', company: '', status: '', ownerId: '' }, '-createdDate');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = list.filters;

  return (
    <>
      <PageHeader title="Customers" icon="people">
        {can('customers:create') && <button className="btn btn-primary" onClick={() => setEdit({})}><i className="bi bi-plus-lg me-1" />New Customer</button>}
      </PageHeader>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Customer Name" aria-label="Customer name" value={f.customerName} onChange={(e) => list.setFilter('customerName', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Email" aria-label="Email" value={f.email} onChange={(e) => list.setFilter('email', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Phone" aria-label="Phone" value={f.phone} onChange={(e) => list.setFilter('phone', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Company" aria-label="Company" value={f.company} onChange={(e) => list.setFilter('company', e.target.value)} /></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All statuses</option>{meta?.customerStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
          {users.length > 1 && <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Owner" value={f.ownerId} onChange={(e) => list.setFilter('ownerId', e.target.value)}><option value="">All owners</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
        </div>
        {list.error && <div className="alert alert-danger">{list.error}</div>}
        <div className="table-responsive">
          <table className="table table-hover">
            <thead><tr>
              <Th field="customerCode" label="Code" {...list} /><Th field="customerName" label="Customer" {...list} /><Th field="companyName" label="Company" {...list} />
              <Th label="Email" /><Th label="Phone" /><Th field="city" label="City" {...list} /><Th field="status" label="Status" {...list} /><Th label="Owner" /><Th field="createdDate" label="Created" {...list} /><th className="text-end">Actions</th>
            </tr></thead>
            <tbody>
              {list.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.customerCode}</td><td><Link to={`/customers/${c.id}`}>{c.customerName}</Link></td><td>{c.companyName}</td>
                  <td>{c.email}</td><td>{c.phone}</td><td>{c.city}</td><td><Badge value={c.status} /></td><td>{c.owner?.name}</td><td>{fmtDate(c.createdDate)}</td>
                  <td className="text-end text-nowrap">
                    <Link to={`/customers/${c.id}`} className="btn btn-sm btn-outline-secondary me-1" title="Details" aria-label="Details"><i className="bi bi-eye" /></Link>
                    {can('customers:update') && <button className="btn btn-sm btn-outline-primary me-1" title="Edit" aria-label="Edit" onClick={() => setEdit(c)}><i className="bi bi-pencil" /></button>}
                    {can('customers:delete') && <button className="btn btn-sm btn-outline-danger" title="Delete" aria-label="Delete" onClick={() => setDel(c)}><i className="bi bi-trash" /></button>}
                  </td>
                </tr>
              ))}
              {!list.loading && list.items.length === 0 && <tr><td colSpan="10" className="text-center text-muted py-4">No customers found.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>

      {edit && <Modal title={edit.id ? 'Edit Customer' : 'New Customer'} onClose={() => setEdit(null)}><CustomerForm customer={edit.id ? edit : null} onCancel={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} /></Modal>}
      {del && <Confirm message={`Delete customer "${del.customerName}"? This action is audited.`} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.delete(`/customers/${del.id}`); toast('Customer deleted.'); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); }
        setDel(null);
      }} />}
    </>
  );
}

export function CustomerDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [tab, setTab] = useState('opps');
  const load = () => api.get(`/customers/${id}/details`).then((r) => setData(r.data.data)).catch((e) => setError(parseError(e).message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;
  const c = data.customer;
  return (
    <>
      <PageHeader title={`${c.customerName} (${c.customerCode})`} icon="person-vcard">
        {can('customers:update') && <button className="btn btn-outline-primary" onClick={() => setEdit(true)}><i className="bi bi-pencil me-1" />Edit</button>}
        {can('customers:delete') && <button className="btn btn-outline-danger" onClick={() => setDel(true)}><i className="bi bi-trash me-1" />Delete</button>}
        <Link className="btn btn-outline-secondary" to="/customers">Back</Link>
      </PageHeader>
      <div className="card mb-3"><div className="card-body row">
        <Detail label="Company">{c.companyName}</Detail><Detail label="Email">{c.email}</Detail><Detail label="Phone">{c.phone}</Detail>
        <Detail label="Address">{[c.address, c.city, c.state].filter(Boolean).join(', ')}</Detail><Detail label="Status"><Badge value={c.status} /></Detail>
        <Detail label="Owner">{c.owner?.name}</Detail><Detail label="Created">{fmtDateTime(c.createdDate)} by {c.createdBy?.name}</Detail>
        <Detail label="Last Activity">{fmtDateTime(c.lastActivityAt)}</Detail><Detail label="Notes">{c.notes}</Detail>
      </div></div>
      <ul className="nav nav-tabs">
        {[['opps', `Opportunities (${data.opportunities.length})`], ['fu', `Follow-Ups (${data.followUps.length})`], ['act', `Activities (${data.activities.length})`], ['hist', 'History'], ['audit', 'Audit Trail']].map(([k, l]) => (
          <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button></li>
        ))}
      </ul>
      <div className="card border-top-0 rounded-top-0"><div className="card-body">
        {tab === 'opps' && <table className="table table-sm"><thead><tr><th>Opportunity</th><th>Stage</th><th>Amount</th><th>Prob.</th><th>Close Date</th><th>Owner</th></tr></thead>
          <tbody>{data.opportunities.map((o) => <tr key={o.id}><td><Link to={`/opportunities/${o.id}`}>{o.opportunityName}</Link></td><td><Badge value={o.stage} /></td><td>{fmtMoney(o.amount)}</td><td>{o.probability}%</td><td>{fmtDate(o.expectedCloseDate)}</td><td>{o.assignedTo?.name}</td></tr>)}</tbody></table>}
        {tab === 'fu' && <table className="table table-sm"><thead><tr><th>Date</th><th>Subject</th><th>Type</th><th>Status</th><th>Owner</th></tr></thead>
          <tbody>{data.followUps.map((f) => <tr key={f.id}><td>{fmtDateTime(f.followUpDate)}</td><td>{f.subject}</td><td>{f.followUpType}</td><td><Badge value={f.status} />{f.isOverdue && <span className="badge text-bg-danger ms-1">Overdue</span>}</td><td>{f.assignedTo?.name}</td></tr>)}</tbody></table>}
        {tab === 'act' && <table className="table table-sm"><thead><tr><th>Date</th><th>Type</th><th>Subject</th><th>Status</th><th>By</th></tr></thead>
          <tbody>{data.activities.map((a) => <tr key={a.id}><td>{fmtDate(a.activityDate)}</td><td>{a.activityType}</td><td>{a.subject}</td><td><Badge value={a.status} /></td><td>{a.assignedTo?.name}</td></tr>)}</tbody></table>}
        {tab === 'hist' && <HistoryTimeline history={c.history} />}
        {tab === 'audit' && <AuditTable rows={data.auditTrail} />}
      </div></div>
      {edit && <Modal title="Edit Customer" onClose={() => setEdit(false)}><CustomerForm customer={c} onCancel={() => setEdit(false)} onDone={() => { setEdit(false); load(); }} /></Modal>}
      {del && <Confirm message={`Delete customer "${c.customerName}"?`} onClose={() => setDel(false)} onConfirm={async () => {
        try { await api.delete(`/customers/${c.id}`); toast('Customer deleted.'); nav('/customers'); } catch (e) { toast(parseError(e).message, 'danger'); setDel(false); }
      }} />}
    </>
  );
}
