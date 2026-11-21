import { fmtDateTime } from '../utils/api';
import { Badge } from '../components/ui';

export function HistoryTimeline({ history = [] }) {
  if (!history.length) return <p className="text-muted small">No history.</p>;
  return (
    <div className="timeline">
      {[...history].reverse().map((h, i) => (
        <div key={i} className="item">
          <strong>{h.action}</strong>{h.from && <> · {h.from} → {h.to}</>}{!h.from && h.to && <> · {h.to}</>}
          {h.note && <div className="small">{h.note}</div>}
          <div className="small text-muted">{fmtDateTime(h.at)} {h.by?.name && `by ${h.by.name}`}</div>
        </div>
      ))}
    </div>
  );
}

const short = (v) => (v ? JSON.stringify(v).slice(0, 160) : '');

export function AuditTable({ rows = [] }) {
  if (!rows.length) return <p className="text-muted small">No audit entries.</p>;
  return (
    <div className="table-responsive">
      <table className="table table-sm small">
        <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Module</th><th>Result</th><th>Old Value</th><th>New Value</th><th>Details</th><th>IP</th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id}>
            <td className="text-nowrap">{fmtDateTime(a.createdDate)}</td><td>{a.userName}</td><td>{a.action}</td><td>{a.entityName}</td><td><Badge value={a.result} /></td>
            <td><code className="small">{short(a.oldValue)}</code></td><td><code className="small">{short(a.newValue)}</code></td><td>{a.details}</td><td>{a.ipAddress}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
