import { useState, useEffect } from 'react';
import api, { fmtDateTime, parseError, toInputDateTime, todayStr } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FormBuilder from '../components/FormBuilder';
import { Modal, Confirm, Pagination, Th, Badge, useList, useLookup, PageHeader, DateRangeFilter } from '../components/ui';
import { HistoryTimeline } from './shared';

const notPastMsg = 'Follow-up date cannot be earlier than today.';
const LOOKUP = { Customer: '/customers/lookup', Lead: '/leads/lookup?open=true', Opportunity: '/opportunities/lookup?open=true' };

function FollowUpForm({ fu, onDone, onCancel }) {
  const { meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const [relatedType, setRelatedType] = useState(fu?.relatedType || 'Customer');
  const [related, setRelated] = useState([]);
  useEffect(() => { if (!fu) api.get(LOOKUP[relatedType]).then((r) => setRelated(r.data.data)); }, [relatedType, fu]);

  const fields = [
    { name: 'subject', label: 'Subject', required: true, minLength: 2, maxLength: 150 },
    { name: 'followUpType', label: 'Follow-Up Type', type: 'select', required: true, options: meta?.followUpTypes || [] },
    { name: 'followUpDate', label: 'Follow-Up Date & Time', type: 'datetime-local', required: true, notPast: true, notPastMessage: notPastMsg, minAttr: `${todayStr()}T00:00` },
    { name: 'assignedToId', label: 'Assigned User', type: 'select', options: users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })), placeholder: 'Me' },
    ...(fu ? [] : [
      { name: 'relatedType', label: 'Related To', type: 'select', required: true, options: meta?.relatedTypes || [] },
      { name: 'relatedId', label: `Related ${relatedType}`, type: 'select', required: true, options: related.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` })) }
    ]),
    { name: 'remarks', label: 'Remarks', type: 'textarea', maxLength: 2000, col: 'col-12' }
  ];
  const initial = fu ? { ...fu, assignedToId: fu.assignedTo?.id, followUpDate: toInputDateTime(fu.followUpDate) } : { relatedType: 'Customer', followUpType: 'Call' };
  return (
    <div onChange={(e) => { if (e.target.name === 'relatedType' && e.target.value) setRelatedType(e.target.value); }}>
      <FormBuilder fields={fields} initial={initial} onCancel={onCancel} onSubmit={async (v) => {
        const body = { ...v, followUpDate: new Date(v.followUpDate).toISOString() };
        if (fu) { delete body.relatedType; delete body.relatedId; }
        const r = fu ? await api.put(`/followups/${fu.id}`, body) : await api.post('/followups', body);
        toast(r.data.message); onDone();
      }} />
    </div>
  );
}

export default function FollowUps() {
  const { can, meta } = useAuth();
  const toast = useToast();
  const users = useLookup('/users/assignable');
  const list = useList('/followups', { view: 'pending', status: '', assignedToId: '', related: '', range: '', from: '', to: '' }, 'followUpDate');
  const [modal, setModal] = useState(null);
  const f = list.filters;
  const close = () => setModal(null);
  const done = () => { setModal(null); list.reload(); };
  const quick = async (fu, action, label) => {
    try { await api.patch(`/followups/${fu.id}/${action}`, {}); toast(label); list.reload(); } catch (e) { toast(parseError(e).message, 'danger'); }
  };

  return (
    <>
      <PageHeader title="Follow-Ups" icon="calendar-check">
        {can('followups:create') && <button className="btn btn-primary" onClick={() => setModal({ type: 'form' })}><i className="bi bi-plus-lg me-1" />Schedule Follow-Up</button>}
      </PageHeader>
      <ul className="nav nav-pills mb-3">
        {[['pending', 'Pending'], ['overdue', 'Overdue'], ['today', 'Due Today'], ['upcoming', 'Upcoming'], ['', 'All']].map(([k, l]) => (
          <li key={k} className="nav-item"><button className={`nav-link ${f.view === k ? 'active' : ''}`} onClick={() => list.setFilter('view', k)}>{l}</button></li>
        ))}
      </ul>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <DateRangeFilter filters={f} setFilter={list.setFilter} />
          {f.view === '' && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Status" value={f.status} onChange={(e) => list.setFilter('status', e.target.value)}><option value="">All statuses</option>{meta?.followUpStatuses.map((s) => <option key={s}>{s}</option>)}</select></div>}
          {users.length > 1 && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Assigned user" value={f.assignedToId} onChange={(e) => list.setFilter('assignedToId', e.target.value)}><option value="">All assigned users</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>}
          <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Related customer / lead" aria-label="Related customer or lead" value={f.related} onChange={(e) => list.setFilter('related', e.target.value)} /></div>
        </div>
        {list.error && <div className="alert alert-danger">{list.error}</div>}
        <div className="table-responsive"><table className="table table-hover">
          <thead><tr><Th field="followUpDate" label="Date" {...list} /><Th field="subject" label="Subject" {...list} /><Th field="followUpType" label="Type" {...list} /><Th label="Related To" /><Th field="status" label="Status" {...list} /><Th label="Assigned To" /><th className="text-end">Actions</th></tr></thead>
          <tbody>
            {list.items.map((fu) => (
              <tr key={fu.id} className={fu.isOverdue ? 'table-danger' : ''}>
                <td className="text-nowrap">{fmtDateTime(fu.followUpDate)}</td>
                <td><button className="btn btn-link p-0 text-start" onClick={() => setModal({ type: 'view', fu })}>{fu.subject}</button></td>
                <td>{fu.followUpType}</td><td>{fu.relatedType}: {fu.relatedName}</td>
                <td><Badge value={fu.status} />{fu.isOverdue && <span className="badge text-bg-danger ms-1">Overdue</span>}</td><td>{fu.assignedTo?.name}</td>
                <td className="text-end text-nowrap">
                  {can('followups:update') && ['Planned', 'Missed'].includes(fu.status) && <>
                    <button className="btn btn-sm btn-success me-1" title="Complete" onClick={() => setModal({ type: 'complete', fu })}><i className="bi bi-check2" /></button>
                    <button className="btn btn-sm btn-outline-primary me-1" title="Reschedule" onClick={() => setModal({ type: 'reschedule', fu })}><i className="bi bi-calendar2-week" /></button>
                  </>}
                  {can('followups:update') && fu.status === 'Planned' && <>
                    <button className="btn btn-sm btn-outline-secondary me-1" title="Edit" onClick={() => setModal({ type: 'form', fu })}><i className="bi bi-pencil" /></button>
                    <button className="btn btn-sm btn-outline-warning me-1" title="Mark missed" onClick={() => quick(fu, 'missed', 'Marked as missed.')}><i className="bi bi-x-circle" /></button>
                  </>}
                  {can('followups:update') && ['Planned', 'Missed'].includes(fu.status) && <button className="btn btn-sm btn-outline-secondary me-1" title="Cancel" onClick={() => setModal({ type: 'cancel', fu })}><i className="bi bi-slash-circle" /></button>}
                  {can('followups:delete') && <button className="btn btn-sm btn-outline-danger" title="Delete" onClick={() => setModal({ type: 'delete', fu })}><i className="bi bi-trash" /></button>}
                </td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan="7" className="text-center text-muted py-4">No follow-ups.</td></tr>}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>

      {modal?.type === 'form' && <Modal title={modal.fu ? 'Edit Follow-Up' : 'Schedule Follow-Up'} onClose={close}><FollowUpForm fu={modal.fu} onCancel={close} onDone={done} /></Modal>}
      {modal?.type === 'complete' && <Modal title={`Complete: ${modal.fu.subject}`} onClose={close} size="md">
        <FormBuilder submitLabel="Mark Completed" onCancel={close} fields={[{ name: 'outcome', label: 'Outcome', type: 'textarea', required: true, minLength: 2, maxLength: 2000, col: 'col-12', help: 'An activity will be logged and the related record updated.' }]}
          onSubmit={async (v) => { await api.patch(`/followups/${modal.fu.id}/complete`, v); toast('Follow-up completed.'); done(); }} />
      </Modal>}
      {modal?.type === 'reschedule' && <Modal title={`Reschedule: ${modal.fu.subject}`} onClose={close} size="md">
        <FormBuilder submitLabel="Reschedule" onCancel={close} fields={[
          { name: 'followUpDate', label: 'New Date & Time', type: 'datetime-local', required: true, notPast: true, notPastMessage: notPastMsg, minAttr: `${todayStr()}T00:00`, col: 'col-12' },
          { name: 'note', label: 'Reason', maxLength: 500, col: 'col-12' }]}
          onSubmit={async (v) => { await api.patch(`/followups/${modal.fu.id}/reschedule`, { ...v, followUpDate: new Date(v.followUpDate).toISOString() }); toast('Follow-up rescheduled.'); done(); }} />
      </Modal>}
      {modal?.type === 'view' && <Modal title={modal.fu.subject} onClose={close} size="md">
        <p><Badge value={modal.fu.status} /> {modal.fu.followUpType} · {fmtDateTime(modal.fu.followUpDate)}</p>
        <p className="small">{modal.fu.relatedType}: {modal.fu.relatedName} · Assigned to {modal.fu.assignedTo?.name}</p>
        {modal.fu.remarks && <p className="small">Remarks: {modal.fu.remarks}</p>}
        {modal.fu.outcome && <p className="small">Outcome: {modal.fu.outcome}</p>}
        <FollowUpHistory id={modal.fu.id} />
      </Modal>}
      {modal?.type === 'cancel' && <Confirm title="Cancel follow-up" confirmLabel="Cancel Follow-Up" variant="warning" message={`Cancel "${modal.fu.subject}"?`} onClose={close} onConfirm={async () => { await quick(modal.fu, 'cancel', 'Follow-up cancelled.'); close(); }} />}
      {modal?.type === 'delete' && <Confirm message={`Delete "${modal.fu.subject}"?`} onClose={close} onConfirm={async () => {
        try { await api.delete(`/followups/${modal.fu.id}`); toast('Follow-up deleted.'); } catch (e) { toast(parseError(e).message, 'danger'); }
        done();
      }} />}
    </>
  );
}

function FollowUpHistory({ id }) {
  const [h, setH] = useState(null);
  useEffect(() => { api.get(`/followups/${id}`).then((r) => setH(r.data.data.history)); }, [id]);
  return h ? <HistoryTimeline history={h} /> : null;
}
