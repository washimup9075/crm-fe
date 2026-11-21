import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { fmtDate, fmtMoney, fmtDateTime, parseError, todayStr } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, useLookup, PageHeader, Loading, Detail } from '../components/ui';
import { AuditTable, HistoryTimeline } from './shared';

function LeadForm({ lead, onDone, onCancel }) {
  const { meta, can } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const statuses = lead
    ? [lead.status, ...(meta?.leadTransitions[lead.status] || [])]
    : (meta?.leadStatuses || []).filter((s) => s !== 'Converted');
  const fields = [
    { name: 'leadName', label: 'Lead Name', required: true, minLength: 2, maxLength: 100 },
    { name: 'companyName', label: 'Company Name', maxLength: 150 },
    { name: 'email', label: 'Email', email: true, maxLength: 254, custom: (v, all) => (!v && !all.phone ? 'Provide at least an email or a phone number.' : null) },
    { name: 'phone', label: 'Phone', phone: true, maxLength: 10 },
    { name: 'source', label: 'Lead Source', type: 'select', required: true, options: meta?.leadSources || [], col: 'col-md-4' },
    { name: 'status', label: 'Lead Status', type: 'select', required: true, options: statuses, col: 'col-md-4' },
    { name: 'priority', label: 'Priority', type: 'select', required: true, options: meta?.priorities || [], col: 'col-md-4' },
    { name: 'expectedValue', label: 'Expected Value (₹)', type: 'number', min: 0, max: meta?.limits.leadExpectedValueMax, rangeMessage: `Expected Value must be between 0 and ${meta?.limits.leadExpectedValueMax}.`, minAttr: 0 },
    { name: 'assignedToId', label: 'Assigned Sales Executive', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })), placeholder: 'Me', disabled: !can('leads:assign') },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, col: 'col-12' }
  ];
  const initial = lead ? { ...lead, assignedToId: lead.assignedTo?.id } : { status: 'New', priority: 'Medium', expectedValue: 0 };
  return (
    <FormBuilder fields={fields} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
      const body = { ...v, expectedValue: v.expectedValue === '' ? 0 : Number(v.expectedValue) };
      const r = lead ? await api.put(`/leads/${lead.id}`, body) : await api.post('/leads', body);
      toast(r.data.message); onDone(r.data.data);
    }} />
  );
}

function ConvertForm({ lead, onDone, onCancel }) {
  const toast = useToast();
  const fields = [
    { name: 'customerName', label: 'Customer Name', required: true, minLength: 2, maxLength: 100 },
    { name: 'companyName', label: 'Company Name', maxLength: 150 },
    { name: 'email', label: 'Email', required: true, email: true },
    { name: 'phone', label: 'Phone', required: true, phone: true, maxLength: 10 },
    { name: 'city', label: 'City', maxLength: 60 },
    { name: 'state', label: 'State', maxLength: 60 },
    { name: 'createOpportunity', label: 'Create opportunity', type: 'checkbox', checkLabel: 'Also create an opportunity', col: 'col-12' },
    { name: 'opportunityName', label: 'Opportunity Name', required: true, maxLength: 150, hidden: (v) => !v.createOpportunity },
    { name: 'amount', label: 'Opportunity Amount (₹)', type: 'number', required: true, gt: 0, gtMessage: 'Opportunity Amount must be greater than 0.', hidden: (v) => !v.createOpportunity, col: 'col-md-3' },
    { name: 'probability', label: 'Probability (%)', type: 'number', required: true, min: 0, max: 100, rangeMessage: 'Probability must be between 0 and 100.', hidden: (v) => !v.createOpportunity, col: 'col-md-3' },
    { name: 'expectedCloseDate', label: 'Expected Close Date', type: 'date', required: true, notPast: true, notPastMessage: 'Expected Close Date cannot be in the past.', minAttr: todayStr(), hidden: (v) => !v.createOpportunity }
  ];
  const initial = { customerName: lead.leadName, companyName: lead.companyName, email: lead.email, phone: lead.phone, createOpportunity: true, opportunityName: `${lead.companyName || lead.leadName} – Deal`, amount: lead.expectedValue || '', probability: 20 };
  return (
    <FormBuilder fields={fields} initial={initial} submitLabel="Convert Lead" onCancel={onCancel} onSubmit={async (v) => {
      const body = {
        customer: { customerName: v.customerName, companyName: v.companyName, email: v.email, phone: v.phone, city: v.city, state: v.state },
        createOpportunity: !!v.createOpportunity,
        ...(v.createOpportunity ? { opportunity: { opportunityName: v.opportunityName, amount: Number(v.amount), probability: Number(v.probability), expectedCloseDate: v.expectedCloseDate } } : {})
      };
      try {
        const r = await api.post(`/leads/${lead.id}/convert`, body);
        toast(r.data.message); onDone(r.data.data);
      } catch (e) {
        // map nested server field names (customer.email / opportunity.amount) to form fields
        const d = e.response?.data?.error?.details;
        if (d) d.forEach((x) => { x.field = x.field.replace(/^(customer|opportunity)\./, ''); });
        throw e;
      }
    }} />
  );
}

export function LeadList() {
  const { can, meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const list = useList('/leads', { leadName: '', company: '', status: '', assignedToId: '', source: '' }, '-createdDate');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = list.filters;
  return (
    <>
      <PageHeader title="Leads" icon="funnel">
        {can('leads:create') && <button className="btn btn-primary" onClick={() => setEdit({})}><i className="bi bi-plus-lg me-1" />New Lead</button>}
      </PageHeader>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Lead Name" aria-label="Lead name" value={f.leadName} onChange={(e) => list.setFilter('leadName', e.target.value)} /></div>
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Company" aria-label="Company" value={f.company} onChange={(e) => list.setFilter('company', e.target.value)} /></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All statuses</option>{meta?.leadStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Source" value={f.source} onChange={(e) => list.setFilter('source', e.target.value)}><option value="">All sources</option>{meta?.leadSources.map((s) => <option key={s}>{s}</option>)}</select></div>
          {users.length > 1 && <div className="col-md-3"><select className="form-select form-select-sm" aria-label="Assigned user" value={f.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)}><option value="">All assigned users</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
        </div>
        {list.error && <div className="alert alert-danger">{list.error}</div>}
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr>
            <Th field="leadCode" label="Code" {...list} /><Th field="leadName" label="Lead" {...list} /><Th field="companyName" label="Company" {...list} /><Th field="source" label="Source" {...list} />
            <Th field="status" label="Status" {...list} /><Th field="priority" label="Priority" {...list} /><Th field="expectedValue" label="Expected Value" {...list} /><Th label="Assigned To" /><Th field="createdDate" label="Created" {...list} /><th className="text-end">Actions</th>
          </tr></thead>
          <tbody>
            {list.items.map((l) => (
              <tr key={l.id}>
                <td>{l.leadCode}</td><td><Link to={`/leads/${l.id}`}>{l.leadName}</Link></td><td>{l.companyName}</td><td>{l.source}</td>
                <td><Badge value={l.status} /></td><td><Badge value={l.priority} /></td><td>{fmtMoney(l.expectedValue)}</td><td>{l.assignedTo?.name}</td><td>{fmtDate(l.createdDate)}</td>
                <td className="text-end text-nowrap">
                  <Link to={`/leads/${l.id}`} className="btn btn-sm btn-outline-secondary me-1" aria-label="Details"><i className="bi bi-eye" /></Link>
                  {can('leads:update') && l.status !== 'Converted' && <button className="btn btn-sm btn-outline-primary me-1" aria-label="Edit" onClick={() => setEdit(l)}><i className="bi bi-pencil" /></button>}
                  {can('leads:delete') && l.status !== 'Converted' && <button className="btn btn-sm btn-outline-danger" aria-label="Delete" onClick={() => setDel(l)}><i className="bi bi-trash" /></button>}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan="10" className="text-center text-muted py-4">No leads found.</td></tr>}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>
      {edit && <Modal title={edit.id ? 'Edit Lead' : 'New Lead'} onClose={() => setEdit(null)}><LeadForm lead={edit.id ? edit : null} onCancel={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} /></Modal>}
      {del && <Confirm message={`Delete lead "${del.leadName}"?`} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.delete(`/leads/${del.id}`); toast('Lead deleted.'); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); }
        setDel(null);
      }} />}
    </>
  );
}

export function LeadDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const users = useLookup(can('leads:assign') ? '/users/assignable' : null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('hist');
  const load = () => api.get(`/leads/${id}/details`).then((r) => setData(r.data.data)).catch((e) => setError(parseError(e).message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (status) => {
    try { await api.patch(`/leads/${id}/status`, { status }); toast(`Lead moved to ${status}.`); load(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };
  const assign = async (assignedToId) => {
    try { await api.patch(`/leads/${id}/assign`, { assignedToId }); toast('Lead assigned.'); load(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;
  const l = data.lead;
  return (
    <>
      <PageHeader title={`${l.leadName} (${l.leadCode})`} icon="funnel">
        {can('leads:update') && l.status !== 'Converted' && <button className="btn btn-outline-primary" onClick={() => setModal('edit')}><i className="bi bi-pencil me-1" />Edit</button>}
        {can('leads:convert') && data.canConvert && <button className="btn btn-success" onClick={() => setModal('convert')}><i className="bi bi-arrow-repeat me-1" />Convert Lead</button>}
        {can('leads:delete') && l.status !== 'Converted' && <button className="btn btn-outline-danger" onClick={() => setModal('delete')}><i className="bi bi-trash" /></button>}
        <Link className="btn btn-outline-secondary" to="/leads">Back</Link>
      </PageHeader>

      <div className="card mb-3"><div className="card-body">
        <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
          <span className="me-1">Status: <Badge value={l.status} /></span>
          {can('leads:update') && data.allowedTransitions.map((s) => <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => setStatus(s)}>Move to {s}</button>)}
          {l.status === 'Contacted' && <small className="text-muted">Qualify the lead to enable conversion.</small>}
        </div>
        <div className="row">
          <Detail label="Company">{l.companyName}</Detail><Detail label="Email">{l.email}</Detail><Detail label="Phone">{l.phone}</Detail>
          <Detail label="Source">{l.source}</Detail><Detail label="Priority"><Badge value={l.priority} /></Detail><Detail label="Expected Value">{fmtMoney(l.expectedValue)}</Detail>
          <Detail label="Assigned To">
            {can('leads:assign') && l.status !== 'Converted' ? (
              <select className="form-select form-select-sm" aria-label="Assign lead" value={l.assignedTo?.id} onChange={(e) => assign(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                {!users.some((u) => u.id === l.assignedTo?.id) && <option value={l.assignedTo?.id}>{l.assignedTo?.name}</option>}
              </select>
            ) : l.assignedTo?.name}
          </Detail>
          <Detail label="Created">{fmtDateTime(l.createdDate)}</Detail><Detail label="Notes">{l.notes}</Detail>
          {l.conversion && <Detail label="Conversion">Converted {fmtDate(l.conversion.convertedAt)} by {l.conversion.convertedBy?.name} → <Link to={`/customers/${l.conversion.customerId}`}>Customer</Link>{l.conversion.opportunityId && <> · <Link to={`/opportunities/${l.conversion.opportunityId}`}>Opportunity</Link></>}</Detail>}
        </div>
      </div></div>

      <ul className="nav nav-tabs">
        {[['hist', 'Status History'], ['fu', `Follow-Ups (${data.followUps.length})`], ['act', `Activities (${data.activities.length})`], ['audit', 'Audit Trail']].map(([k, t]) => (
          <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{t}</button></li>
        ))}
      </ul>
      <div className="card border-top-0 rounded-top-0"><div className="card-body">
        {tab === 'hist' && <HistoryTimeline history={l.history} />}
        {tab === 'fu' && <table className="table table-sm"><tbody>{data.followUps.map((f) => <tr key={f.id}><td>{fmtDateTime(f.followUpDate)}</td><td>{f.subject}</td><td><Badge value={f.status} /></td><td>{f.assignedTo?.name}</td></tr>)}</tbody></table>}
        {tab === 'act' && <table className="table table-sm"><tbody>{data.activities.map((a) => <tr key={a.id}><td>{fmtDate(a.activityDate)}</td><td>{a.activityType}</td><td>{a.subject}</td><td><Badge value={a.status} /></td></tr>)}</tbody></table>}
        {tab === 'audit' && <AuditTable rows={data.auditTrail} />}
      </div></div>

      {modal === 'edit' && <Modal title="Edit Lead" onClose={() => setModal(null)}><LeadForm lead={l} onCancel={() => setModal(null)} onDone={() => { setModal(null); load(); }} /></Modal>}
      {modal === 'convert' && <Modal title="Convert Lead" onClose={() => setModal(null)}><ConvertForm lead={l} onCancel={() => setModal(null)} onDone={(r) => { setModal(null); nav(`/customers/${r.customer.id}`); }} /></Modal>}
      {modal === 'delete' && <Confirm message={`Delete lead "${l.leadName}"?`} onClose={() => setModal(null)} onConfirm={async () => {
        try { await api.delete(`/leads/${l.id}`); toast('Lead deleted.'); nav('/leads'); } catch (e) { toast(parseError(e).message, 'danger'); setModal(null); }
      }} />}
    </>
  );
}
