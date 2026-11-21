import { useEffect, useState, useCallback } from 'react';
import api, { parseError } from '../utils/api';

export function Modal({ title, onClose, children, size = 'lg' }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <>
      <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className={`modal-dialog modal-${size} modal-dialog-scrollable`}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

/** Confirmation dialog for destructive actions. */
export function Confirm({ title = 'Please confirm', message, confirmLabel = 'Delete', variant = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p>{message}</p>
      <div className="d-flex gap-2 justify-content-end">
        <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn btn-${variant}`} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return meta ? <small className="text-muted">{meta.total} record(s)</small> : null;
  const { page, totalPages, total } = meta;
  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);
  return (
    <div className="d-flex justify-content-between align-items-center">
      <small className="text-muted">{total} record(s) · page {page} of {totalPages}</small>
      <nav aria-label="Pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => onPage(page - 1)}>‹</button></li>
          {pages.map((p) => <li key={p} className={`page-item ${p === page ? 'active' : ''}`}><button className="page-link" onClick={() => onPage(p)}>{p}</button></li>)}
          <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}><button className="page-link" onClick={() => onPage(page + 1)}>›</button></li>
        </ul>
      </nav>
    </div>
  );
}

/** Sortable table header cell. */
export function Th({ field, label, sort, setSort }) {
  if (!field) return <th scope="col">{label}</th>;
  const active = sort === field || sort === `-${field}`;
  const desc = sort === `-${field}`;
  return (
    <th scope="col" role="button" className="text-nowrap" onClick={() => setSort(active && !desc ? `-${field}` : field)}>
      {label} {active ? <i className={`bi bi-caret-${desc ? 'down' : 'up'}-fill small`} /> : <i className="bi bi-arrow-down-up small text-muted" />}
    </th>
  );
}

const BADGE = {
  New: 'secondary', Contacted: 'info', Qualified: 'primary', Unqualified: 'warning', Converted: 'success', Lost: 'danger',
  Active: 'success', Inactive: 'secondary', Prospect: 'info',
  Qualification: 'secondary', Proposal: 'info', Negotiation: 'warning', Won: 'success', Open: 'primary',
  Planned: 'primary', Completed: 'success', Missed: 'danger', Cancelled: 'secondary',
  High: 'danger', Medium: 'warning', Low: 'secondary', Success: 'success', Failure: 'danger',
  Admin: 'dark', Manager: 'primary', SalesExecutive: 'info'
};
export const Badge = ({ value }) => <span className={`badge text-bg-${BADGE[value] || 'light'}`}>{value}</span>;

/** List-page state: filters, sort, page, loading and data from a paginated endpoint. */
export function useList(endpoint, initialFilters = {}, defaultSort = '') {
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], meta: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined)), page, limit: 10 };
      if (sort) params.sort = sort;
      const r = await api.get(endpoint, { params });
      setData({ items: r.data.data, meta: r.data.meta, extra: r.data });
    } catch (e) { setError(parseError(e).message); } finally { setLoading(false); }
  }, [endpoint, filters, sort, page]);

  useEffect(() => { load(); }, [load]);
  const setFilter = (k, v) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };
  return { ...data, filters, setFilter, setFilters, sort, setSort: (s) => { setPage(1); setSort(s); }, page, setPage, loading, error, reload: load };
}

/** Fetch a lookup list (assignable users, customers, leads …) once. */
export function useLookup(url, deps = []) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!url) return;
    api.get(url).then((r) => setItems(r.data.data)).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  return items;
}

export const PageHeader = ({ title, icon, children }) => (
  <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
    <h1 className="h4 mb-0"><i className={`bi bi-${icon} me-2`} />{title}</h1>
    <div className="d-flex gap-2">{children}</div>
  </div>
);

export const Loading = () => <div className="text-center py-5"><div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div></div>;

export function DateRangeFilter({ filters, setFilter }) {
  return (
    <>
      <div className="col-auto">
        <select className="form-select form-select-sm" aria-label="Date range" value={filters.range || ''} onChange={(e) => setFilter('range', e.target.value)}>
          <option value="">All dates</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Range</option>
        </select>
      </div>
      {filters.range === 'custom' && (
        <>
          <div className="col-auto"><input type="date" className="form-control form-control-sm" aria-label="From date" value={filters.from || ''} onChange={(e) => setFilter('from', e.target.value)} /></div>
          <div className="col-auto"><input type="date" className="form-control form-control-sm" aria-label="To date" value={filters.to || ''} onChange={(e) => setFilter('to', e.target.value)} /></div>
        </>
      )}
    </>
  );
}

export const Detail = ({ label, children }) => (
  <div className="col-sm-6 col-lg-4 mb-3"><div className="small text-muted">{label}</div><div className="fw-medium">{children || '—'}</div></div>
);
