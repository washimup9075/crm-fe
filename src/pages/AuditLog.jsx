import { useAuth } from '../context/AuthContext';
import { Pagination, Th, Badge, useList, PageHeader, DateRangeFilter } from '../components/ui';
import { fmtDateTime } from '../utils/api';

const short = (v) => (v ? JSON.stringify(v) : '');

export default function AuditLog() {
  const { meta } = useAuth();
  const list = useList('/audit-logs', { user: '', module: '', action: '', result: '', range: '', from: '', to: '' }, '-createdDate');
  const f = list.filters;
  const modules = list.extra?.filters?.modules || [];
  return (
    <>
      <PageHeader title="Audit Log" icon="journal-text">
        <a className="btn btn-outline-secondary" href={`/api/reports/audit?format=csv&${new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}`}><i className="bi bi-download me-1" />Export CSV</a>
      </PageHeader>
      <div className="alert alert-light border small py-2"><i className="bi bi-lock me-1" />Audit records are append-only and cannot be edited or deleted.</div>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-md-2"><input className="form-control form-control-sm" placeholder="User" aria-label="User" value={f.user} onChange={(e) => list.setFilter('user', e.target.value)} /></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Module" value={f.module} onChange={(e) => list.setFilter('module', e.target.value)}><option value="">All modules</option>{modules.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Action" value={f.action} onChange={(e) => list.setFilter('action', e.target.value)}><option value="">All actions</option>{meta?.auditActions.map((a) => <option key={a}>{a}</option>)}</select></div>
          <div className="col-md-2"><select className="form-select form-select-sm" aria-label="Result" value={f.result} onChange={(e) => list.setFilter('result', e.target.value)}><option value="">All results</option><option>Success</option><option>Failure</option></select></div>
          <DateRangeFilter filters={f} setFilter={list.setFilter} />
        </div>
        <div className="table-responsive"><table className="table table-sm small">
          <thead><tr><Th field="createdDate" label="Timestamp" {...list} /><Th field="userName" label="User" {...list} /><Th field="action" label="Action" {...list} /><Th field="entityName" label="Module" {...list} /><Th label="Record Id" /><Th field="result" label="Result" {...list} /><Th label="Old Value" /><Th label="New Value" /><Th label="Details" /><Th label="IP Address" /></tr></thead>
          <tbody>
            {list.items.map((a) => (
              <tr key={a.id}>
                <td className="text-nowrap">{fmtDateTime(a.createdDate)}</td><td>{a.userName}</td><td>{a.action}</td><td>{a.entityName}</td><td><code>{a.recordId?.slice(-8)}</code></td><td><Badge value={a.result} /></td>
                <td style={{ maxWidth: 220 }}><code className="small text-break">{short(a.oldValue)}</code></td><td style={{ maxWidth: 220 }}><code className="small text-break">{short(a.newValue)}</code></td>
                <td>{a.details}</td><td>{a.ipAddress}</td>
              </tr>
            ))}
            {!list.loading && list.items.length === 0 && <tr><td colSpan="10" className="text-center text-muted py-4">No audit entries.</td></tr>}
          </tbody>
        </table></div>
        <Pagination meta={list.meta} onPage={list.setPage} />
      </div></div>
    </>
  );
}
