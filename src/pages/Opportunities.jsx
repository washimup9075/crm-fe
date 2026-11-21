import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api, { fmtDate, fmtMoney, fmtDateTime, parseError, toInputDate, todayStr } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, useLookup, PageHeader, Loading, Detail } from '../components/ui';
import { AuditTable, HistoryTimeline } from './shared';

const ACTIVE = ['Qualification', 'Proposal', 'Negotiation'];

export function OpportunityForm({ opp, presetCustomerId, onDone, onCancel }) {
  const { meta } = useAuth();
  const toast = useToast();
  const customers = useLookup('/customers/lookup');
  const users = useLookup('/users/assignable');
  const stages = opp ? meta?.opportunityStages : ACTIVE;
  const isActive = (v) => ACTIVE.includes(v.stage);
  const fields = [
    { name: 'opportunityName', label: 'Opportunity Name', required: true, minLength: 2, maxLength: 150 },
    { name: 'customerId', label: 'Customer', type: 'select', required: true, options: customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })) },
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0, gt: undefined, minAttr: 0, step: '0.01', col: 'col-md-4',
      custom: (v, all) => (isActive(all) && Number(v) <= 0 ? 'Opportunity Amount must be greater than 0.' : null), rangeMessage: 'Opportunity Amount cannot be negative.' },
    { name: 'probability', label: 'Probability (%)', type: 'number', required: true, min: 0, max: 100, rangeMessage: 'Probability must be between 0 and 100.', col: 'col-md-4' },
    { name: 'stage', label: 'Stage', type: 'select', required: true, options: stages || [], col: 'col-md-4' },
    { name: 'expectedCloseDate', label: 'Expected Close Date', type: 'date', required: true, notPast: isActive, notPastMessage: 'Expected Close Date cannot be in the past.', minAttr: todayStr() },
    { name: 'source', label: 'Source', type: 'select', options: meta?.leadSources || [] },
    { name: 'assignedToId', label: 'Owner', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })), placeholder: 'Me' },
    { name: 'outcomeReason', label: 'Outcome Reason', maxLength: 500, hidden: (v) => isActive(v), required: true },
    { name: 'notes', label: 'Notes', type: 'textarea', maxLength: 2000, col: 'col-12' }
  ];
  const initial = opp
    ? { ...opp, customerId: opp.customer?.id, assignedToId: opp.assignedTo?.id, expectedCloseDate: toInputDate(opp.expectedCloseDate) }
    : { stage: 'Qualification', probability: 20, customerId: presetCustomerId || '' };
  return (
    <FormBuilder fields={fields} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
      const body = { ...v, amount: Number(v.amount), probability: Number(v.probability) };
      if (!body.leadId) delete body.leadId;
      const r = opp ? await api.put(`/opportunities/${opp.id}`, body) : await api.post('/opportunities', body);
      toast(r.data.message); onDone(r.data.data);
    }} />
  );
}

/** Captures the final outcome when marking Won/Lost. */
export function OutcomeModal({ opp, stage, onClose, onDone }) {
  const toast = useToast();
  return (
    <Modal title={`Mark "${opp.opportunityName}" as ${stage}`} onClose={onClose} size="md">
      <FormBuilder submitLabel={`Mark ${stage}`} onCancel={onClose}
        fields={[{ name: 'outcomeReason', label: stage === 'Won' ? 'Outcome notes' : 'Reason for loss', required: stage === 'Lost', maxLength: 500, type: 'textarea', col: 'col-12' }]}
        onSubmit={async (v) => { await api.patch(`/opportunities/${opp.id}/stage`, { stage, outcomeReason: v.outcomeReason }); toast(`Opportunity marked ${stage}.`); onDone(); }} />
    </Modal>
  );
}

export function OpportunityList() {
  const { can, meta } = useAuth();
  const toast = useToast();
  const list = useList('/opportunities', { opportunityName: '', customer: '', stage: '', status: '' }, '-createdDate');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const f = list.filters;
  return (
    <>
      <PageHeader title="Opportunities" icon="briefcase">
        <Link to="/pipeline" className="btn btn-outline-primary"><i className="bi bi-kanban me-1" />Pipeline</Link>
        {can('opportunities:create') && <button className="btn btn-primary" onClick={() => setEdit({})}><i className="bi bi-plus-lg me-1" />New Opportunity</button>}
      </PageHeader>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Opportunity Name" aria-label="Opportunity name" value={f.opportunityName} onChange={(e) => list.setFilter('opportunityName', e.target.value)} /></div>
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Customer" aria-label="Customer" value={f.customer} onChange={(e) => list.setFilter('customer', e.target.value)} /></div>
          <div className="col-md-3"><select className="form-select form-select-sm" aria-label="Stage" value={f.stage} onChange={(e) => list.setFilter('stage', e.target.value)}><option value="">All stages</option>{meta?.opportunityStages.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="col-md-3"><select className="form-select form-select-sm" aria-label="Status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All statuses</option>{meta?.opportunityStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        {list.error && <div className="alert alert-danger">{list.error}</div>}
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr>
            <Th field="opportunityCode" label="Code" {...list} /><Th field="opportunityName" label="Opportunity" {...list} /><Th label="Customer" /><Th field="stage" label="Stage" {...list} />
            <Th field="amount" label="Amount" {...list} /><Th field="probability" label="Prob." {...list} /><Th label="Weighted" /><Th field="expectedCloseDate" label="Close Date" {...list} /><Th label="Owner" /><th className="text-end">Actions</th>
          </tr></thead>
          <tbody>
            {list.items.map((o) => (
              <tr key={o.id}>
                <td>{o.opportunityCode}</td><td><Link to={`/opportunities/${o.id}`}>{o.opportunityName}</Link></td><td>{o.customer?.name}</td><td><Badge value={o.stage} /></td>
                <td>{fmtMoney(o.amount)}</td><td>{o.probability}%</td><td>{fmtMoney(o.weightedAmount)}</td><td>{fmtDate(o.expectedCloseDate)}</td><td>{o.assignedTo?.name}</td>
                <td className="text-end text-nowrap">
                  <Link to={`/opportunities/${o.id}`} className="btn btn-sm btn-outline-secondary me-1" aria-label="Details"><i className="bi bi-eye" /></Link>
                  {can('opportunities:update') && o.status === 'Open' && <button className="btn btn-sm btn-outline-primary me-1" aria-label="Edit" onClick={() => setEdit(o)}><i className="bi bi-pencil" /></button>}
                  {can('opportunities:delete') && <button className="btn btn-sm btn-outline-danger" aria-label="Delete" onClick={() => setDel(o)}><i className="bi bi-trash" /></button>}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan="10" className="text-center text-muted py-4">No opportunities found.</td></tr>}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>
      {edit && <Modal title={edit.id ? 'Edit Opportunity' : 'New Opportunity'} onClose={() => setEdit(null)}><OpportunityForm opp={edit.id ? edit : null} onCancel={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(); }} /></Modal>}
      {del && <Confirm message={`Delete opportunity "${del.opportunityName}"?`} onClose={() => setDel(null)} onConfirm={async () => {
        try { await api.delete(`/opportunities/${del.id}`); toast('Opportunity deleted.'); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); }
        setDel(null);
      }} />}
    </>
  );
}

export function OpportunityDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('hist');
  const load = () => api.get(`/opportunities/${id}/details`).then((r) => setData(r.data.data)).catch((e) => setError(parseError(e).message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (stage) => {
    if (stage === 'Won' || stage === 'Lost') { setModal(stage); return; }
    try { await api.patch(`/opportunities/${id}/stage`, { stage }); toast(`Moved to ${stage}.`); load(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;
  const o = data.opportunity;
  const open = o.status === 'Open';
  return (
    <>
      <PageHeader title={`${o.opportunityName} (${o.opportunityCode})`} icon="briefcase">
        {can('opportunities:update') && open && <button className="btn btn-outline-primary" onClick={() => setModal('edit')}><i className="bi bi-pencil me-1" />Edit</button>}
        {can('opportunities:delete') && <button className="btn btn-outline-danger" onClick={() => setModal('delete')}><i className="bi bi-trash" /></button>}
        <Link className="btn btn-outline-secondary" to="/opportunities">Back</Link>
      </PageHeader>
      <div className="card mb-3"><div className="card-body">
        {open && can('opportunities:update') && (
          <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
            <span className="me-1">Stage:</span>
            {ACTIVE.map((s) => <button key={s} className={`btn btn-sm ${o.stage === s ? 'btn-primary' : 'btn-outline-primary'}`} disabled={o.stage === s} onClick={() => move(s)}>{s}</button>)}
            <button className="btn btn-sm btn-success" onClick={() => move('Won')}><i className="bi bi-trophy me-1" />Mark Won</button>
            <button className="btn btn-sm btn-danger" onClick={() => move('Lost')}><i className="bi bi-x-octagon me-1" />Mark Lost</button>
          </div>
        )}
        <div className="row">
          <Detail label="Customer"><Link to={`/customers/${o.customer?.id}`}>{o.customer?.name}</Link></Detail><Detail label="Stage"><Badge value={o.stage} /></Detail><Detail label="Status"><Badge value={o.status} /></Detail>
          <Detail label="Amount">{fmtMoney(o.amount)}</Detail><Detail label="Probability">{o.probability}%</Detail><Detail label="Weighted (Amount × Probability / 100)">{fmtMoney(o.weightedAmount)}</Detail>
          <Detail label="Expected Close Date">{fmtDate(o.expectedCloseDate)}</Detail><Detail label="Owner">{o.assignedTo?.name}</Detail><Detail label="Source">{o.source}</Detail>
          {!open && <><Detail label="Closed On">{fmtDate(o.closedDate)}</Detail><Detail label="Final Outcome">{o.outcomeReason}</Detail></>}
          <Detail label="Notes">{o.notes}</Detail>
        </div>
      </div></div>
      <ul className="nav nav-tabs">
        {[['hist', 'Stage History'], ['fu', `Follow-Ups (${data.followUps.length})`], ['act', `Activities (${data.activities.length})`], ['audit', 'Audit Trail']].map(([k, t]) => (
          <li key={k} className="nav-item"><button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{t}</button></li>
        ))}
      </ul>
      <div className="card border-top-0 rounded-top-0"><div className="card-body">
        {tab === 'hist' && <HistoryTimeline history={o.history} />}
        {tab === 'fu' && <table className="table table-sm"><tbody>{data.followUps.map((f) => <tr key={f.id}><td>{fmtDateTime(f.followUpDate)}</td><td>{f.subject}</td><td><Badge value={f.status} /></td></tr>)}</tbody></table>}
        {tab === 'act' && <table className="table table-sm"><tbody>{data.activities.map((a) => <tr key={a.id}><td>{fmtDate(a.activityDate)}</td><td>{a.activityType}</td><td>{a.subject}</td></tr>)}</tbody></table>}
        {tab === 'audit' && <AuditTable rows={data.auditTrail} />}
      </div></div>
      {modal === 'edit' && <Modal title="Edit Opportunity" onClose={() => setModal(null)}><OpportunityForm opp={o} onCancel={() => setModal(null)} onDone={() => { setModal(null); load(); }} /></Modal>}
      {(modal === 'Won' || modal === 'Lost') && <OutcomeModal opp={o} stage={modal} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === 'delete' && <Confirm message={`Delete opportunity "${o.opportunityName}"?`} onClose={() => setModal(null)} onConfirm={async () => {
        try { await api.delete(`/opportunities/${o.id}`); toast('Opportunity deleted.'); nav('/opportunities'); } catch (e) { toast(parseError(e).message, 'danger'); setModal(null); }
      }} />}
    </>
  );
}

/** Sales pipeline (Kanban). Drag a card to another stage, or use the arrow buttons. */
export function Pipeline() {
  const { can } = useAuth();
  const toast = useToast();
  const [cols, setCols] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const load = () => api.get('/opportunities/pipeline').then((r) => setCols(r.data.data));
  useEffect(() => { load(); }, []);

  const move = async (opp, stage) => {
    if (opp.stage === stage) return;
    if (opp.status !== 'Open') { toast('Closed opportunities cannot be moved.', 'warning'); return; }
    if (stage === 'Won' || stage === 'Lost') { setOutcome({ opp, stage }); return; }
    try { await api.patch(`/opportunities/${opp.id}/stage`, { stage }); toast(`Moved to ${stage}.`); load(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };

  if (!cols) return <Loading />;
  const all = cols.flatMap((c) => c.items);
  return (
    <>
      <PageHeader title="Sales Pipeline" icon="kanban"><Link to="/opportunities" className="btn btn-outline-secondary">List view</Link></PageHeader>
      <div className="kanban">
        {cols.map((c) => (
          <div key={c.stage} className="kanban-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const o = all.find((x) => x.id === e.dataTransfer.getData('id')); if (o && can('opportunities:update')) move(o, c.stage); }}>
            <div className="d-flex justify-content-between mb-2 px-1"><strong>{c.stage}</strong><span className="badge text-bg-light">{c.count}</span></div>
            <div className="small text-muted px-1 mb-2">{fmtMoney(c.amount)} · weighted {fmtMoney(c.weightedAmount)}</div>
            {c.items.map((o) => (
              <div key={o.id} className="kanban-card" draggable={o.status === 'Open' && can('opportunities:update')} onDragStart={(e) => e.dataTransfer.setData('id', o.id)}>
                <Link to={`/opportunities/${o.id}`} className="fw-medium text-decoration-none">{o.opportunityName}</Link>
                <div className="small text-muted">{o.customer?.name}</div>
                <div className="d-flex justify-content-between small mt-1"><span>{fmtMoney(o.amount)}</span><span>{o.probability}%</span></div>
                <div className="small text-muted">Close {fmtDate(o.expectedCloseDate)} · {o.assignedTo?.name}</div>
                {o.status === 'Open' && can('opportunities:update') && (
                  <div className="d-flex gap-1 mt-1">
                    {ACTIVE.indexOf(o.stage) > 0 && <button className="btn btn-sm btn-light py-0" aria-label="Previous stage" onClick={() => move(o, ACTIVE[ACTIVE.indexOf(o.stage) - 1])}>‹</button>}
                    {ACTIVE.indexOf(o.stage) < 2 && <button className="btn btn-sm btn-light py-0" aria-label="Next stage" onClick={() => move(o, ACTIVE[ACTIVE.indexOf(o.stage) + 1])}>›</button>}
                    <button className="btn btn-sm btn-outline-success py-0 ms-auto" onClick={() => move(o, 'Won')}>Won</button>
                    <button className="btn btn-sm btn-outline-danger py-0" onClick={() => move(o, 'Lost')}>Lost</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {outcome && <OutcomeModal opp={outcome.opp} stage={outcome.stage} onClose={() => setOutcome(null)} onDone={() => { setOutcome(null); load(); }} />}
    </>
  );
}
