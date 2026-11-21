import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import api, { fmtMoney, fmtDate, fmtDateTime, parseError } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Pagination, Badge, PageHeader, DateRangeFilter, Loading, useLookup } from '../components/ui';

const MONEY = ['amount', 'weighted', 'weightedAmount', 'expectedValue', 'wonAmount', 'Qualification', 'Proposal', 'Negotiation'];
const DATES = ['createdDate', 'expectedCloseDate', 'followUpDate', 'lastActivity', 'converted'];
const BADGES = ['status', 'stage', 'priority', 'result', 'role'];

function cell(row, col) {
  let v = row[col.key];
  if (col.key === 'owner' && row.owner?.name) v = row.owner.name;
  if (col.key === 'assignedTo') v = row.assignedTo?.name;
  if (col.key === 'customer') v = row.customer?.name;
  if (col.key === 'converted') v = row.conversion?.convertedAt;
  if (col.key === 'related') v = `${row.relatedType}: ${row.relatedName || ''}`;
  if (col.key === 'isOverdue') return row.isOverdue ? <span className="badge text-bg-danger">Overdue</span> : '';
  if (col.key === 'oldValue' || col.key === 'newValue') return <code className="small">{v ? JSON.stringify(v).slice(0, 80) : ''}</code>;
  if (col.key === 'createdDate' && row.action) return fmtDateTime(v);
  if (MONEY.includes(col.key)) return fmtMoney(v);
  if (DATES.includes(col.key)) return fmtDate(v);
  if (BADGES.includes(col.key) && v) return <Badge value={v} />;
  if (col.key.endsWith('Rate') || col.key === 'probability') return `${v ?? 0}%`;
  return v ?? '';
}

function Table({ columns, rows }) {
  return (
    <div className="table-responsive"><table className="table table-sm table-striped">
      <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => <tr key={r.id || r.userId || r.stage || r.owner || i}>{columns.map((c) => <td key={c.key}>{cell(r, c)}</td>)}</tr>)}
        {rows.length === 0 && <tr><td colSpan={columns.length} className="text-center text-muted py-3">No data for the selected filters.</td></tr>}
      </tbody>
    </table></div>
  );
}

const Summary = ({ items }) => (
  <div className="row g-2 mb-3">{items.map(([l, v]) => <div key={l} className="col-6 col-md-2"><div className="border rounded p-2 text-center"><div className="fw-semibold">{v}</div><small className="text-muted">{l}</small></div></div>)}</div>
);

export default function Reports() {
  const { meta } = useAuth();
  const users = useLookup('/users/assignable');
  const [catalogue, setCatalogue] = useState([]);
  const [type, setType] = useState('');
  const [filters, setFilters] = useState({ range: '', from: '', to: '', status: '', stage: '', assignedToId: '', ownerId: '', view: '' });
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/reports').then((r) => { setCatalogue(r.data.data); setType(r.data.data[0]?.key || ''); }); }, []);
  const params = () => {
    const p = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 15 };
    if (sort) p.sort = sort;
    return p;
  };
  useEffect(() => {
    if (!type) return;
    setData(null); setError('');
    api.get(`/reports/${type}`, { params: params() }).then((r) => setData(r.data.data)).catch((e) => setError(parseError(e).message));
  }, [type, filters, sort, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };
  const csv = (extra = {}) => `/api/reports/${type}?${new URLSearchParams({ ...params(), ...extra, format: 'csv' })}`;
  const sortable = { customers: ['customerName', 'status', 'createdDate'], leads: ['leadName', 'source', 'status', 'createdDate'], followups: ['followUpDate', 'status'], opportunities: ['opportunityName', 'stage', 'amount', 'probability', 'expectedCloseDate'], audit: ['createdDate', 'action', 'entityName'] }[type] || [];
  const statusOptions = { customers: meta?.customerStatuses, leads: meta?.leadStatuses, followups: meta?.followUpStatuses, opportunities: meta?.opportunityStatuses }[type];

  return (
    <>
      <PageHeader title="Reports" icon="bar-chart">
        {type && type !== 'pipeline' && <a className="btn btn-outline-secondary" href={csv()}><i className="bi bi-download me-1" />Export CSV</a>}
        {type === 'pipeline' && <><a className="btn btn-outline-secondary" href={csv({ groupBy: 'stage' })}><i className="bi bi-download me-1" />Stage CSV</a><a className="btn btn-outline-secondary" href={csv({ groupBy: 'owner' })}><i className="bi bi-download me-1" />Owner CSV</a></>}
      </PageHeader>
      <ul className="nav nav-tabs mb-3">
        {catalogue.map((c) => <li key={c.key} className="nav-item"><button className={`nav-link ${type === c.key ? 'active' : ''}`} onClick={() => { setType(c.key); setPage(1); setSort(''); setFilters((f) => ({ ...f, status: '', stage: '', view: '' })); }}>{c.title}</button></li>)}
      </ul>
      <div className="card"><div className="card-body">
        <div className="row g-2 mb-3 align-items-center">
          <DateRangeFilter filters={filters} setFilter={setFilter} />
          {statusOptions && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">All statuses</option>{statusOptions.map((s) => <option key={s}>{s}</option>)}</select></div>}
          {['opportunities', 'pipeline'].includes(type) && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Stage" value={filters.stage} onChange={(e) => setFilter('stage', e.target.value)}><option value="">All stages</option>{meta?.opportunityStages.map((s) => <option key={s}>{s}</option>)}</select></div>}
          {type === 'followups' && <div className="col-auto"><select className="form-select form-select-sm" aria-label="View" value={filters.view} onChange={(e) => setFilter('view', e.target.value)}><option value="">All</option><option value="overdue">Overdue only</option><option value="upcoming">Upcoming</option></select></div>}
          {users.length > 1 && !['audit', 'user-activity', 'conversion'].includes(type) && (
            <div className="col-auto"><select className="form-select form-select-sm" aria-label="Owner" value={type === 'customers' ? filters.ownerId : filters.assignedToId} onChange={(e) => setFilter(type === 'customers' ? 'ownerId' : 'assignedToId', e.target.value)}><option value="">All owners</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          )}
          {sortable.length > 0 && <div className="col-auto"><select className="form-select form-select-sm" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="">Default sort</option>{sortable.flatMap((s) => [<option key={s} value={s}>{s} ↑</option>, <option key={`-${s}`} value={`-${s}`}>{s} ↓</option>])}</select></div>}
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {!data && !error && <Loading />}
        {data && type === 'customers' && <><Summary items={[['Total', data.summary.total], ...data.summary.byStatus.map((s) => [s.label, s.count])]} /><Table columns={data.columns} rows={data.rows} /><Pagination meta={data.meta} onPage={setPage} /></>}
        {data && type === 'leads' && <><Summary items={[['Total', data.summary.total], ['Converted', data.summary.converted], ['Conversion %', `${data.summary.conversionRate}%`], ...data.summary.bySource.slice(0, 3).map((s) => [s.label, s.count])]} /><Table columns={data.columns} rows={data.rows} /><Pagination meta={data.meta} onPage={setPage} /></>}
        {data && type === 'followups' && <><Summary items={[['Total', data.summary.total], ['Overdue', data.summary.overdue], ...data.summary.byStatus.map((s) => [s.label, s.count])]} /><Table columns={data.columns} rows={data.rows} /><Pagination meta={data.meta} onPage={setPage} /></>}
        {data && type === 'opportunities' && <><Summary items={[['Total', data.summary.total], ['Amount', fmtMoney(data.summary.totalAmount)], ['Weighted', fmtMoney(data.summary.weightedAmount)]]} /><Table columns={data.columns} rows={data.rows} /><Pagination meta={data.meta} onPage={setPage} /></>}
        {data && type === 'pipeline' && <>
          <Summary items={[['Open Opps', data.summary.openCount], ['Open Amount', fmtMoney(data.summary.openAmount)], ['Weighted Pipeline', fmtMoney(data.summary.weightedPipeline)]]} />
          <div className="row"><div className="col-lg-6"><h3 className="h6">Stage-wise</h3><Table columns={data.stageColumns} rows={data.byStage} /></div>
            <div className="col-lg-6"><Bar data={{ labels: data.byStage.map((s) => s.stage), datasets: [{ label: 'Amount', data: data.byStage.map((s) => s.amount), backgroundColor: '#0d6efd' }, { label: 'Weighted', data: data.byStage.map((s) => s.weighted), backgroundColor: '#20c997' }] }} /></div></div>
          <h3 className="h6 mt-3">Owner-wise (open pipeline)</h3><Table columns={data.ownerColumns} rows={data.byOwner} />
        </>}
        {data && type === 'conversion' && <>
          <Summary items={[['Leads', data.summary.leads], ['Converted', data.summary.converted], ['Not Converted', data.summary.notConverted], ['Conversion %', `${data.summary.conversionRate}%`], ['Won / Lost', `${data.summary.won} / ${data.summary.lost}`], ['Win %', `${data.summary.winRate}%`]]} />
          <Table columns={data.columns} rows={data.byOwner} />
          <h3 className="h6 mt-3">By Lead Source</h3>
          <Table columns={[{ key: 'source', label: 'Source' }, { key: 'leads', label: 'Leads' }, { key: 'converted', label: 'Converted' }, { key: 'conversionRate', label: 'Conversion %' }]} rows={data.bySource} />
        </>}
        {data && type === 'user-activity' && <Table columns={data.columns} rows={data.rows} />}
        {data && type === 'audit' && <><Table columns={data.columns} rows={data.rows} /><Pagination meta={data.meta} onPage={setPage} /></>}
      </div></div>
    </>
  );
}
