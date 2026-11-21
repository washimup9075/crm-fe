import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import api, { fmtMoney, fmtDateTime, fmtDate, parseError } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Loading, Badge, DateRangeFilter } from '../components/ui';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);

const COLORS = ['#6c757d', '#0dcaf0', '#0d6efd', '#ffc107', '#198754', '#dc3545'];

const Kpi = ({ label, value, icon, color, to }) => (
  <div className="col-6 col-md-4 col-xl-3">
    <Link to={to || '#'} className="text-decoration-none">
      <div className="card kpi h-100"><div className="card-body d-flex justify-content-between align-items-center">
        <div><div className="small text-muted">{label}</div><div className="value text-dark">{value}</div></div>
        <i className={`bi bi-${icon} text-${color}`} />
      </div></div>
    </Link>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ range: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/dashboard', { params }).then((r) => setData(r.data.data)).catch((e) => setError(parseError(e).message));
  }, [filters]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;
  const c = data.cards;
  const ch = data.charts;
  const scopeText = { all: 'All records', team: 'Your team', own: 'Your assigned records' }[data.scope];

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div><h1 className="h4 mb-0">Dashboard</h1><small className="text-muted">Welcome, {user.name} · {scopeText}</small></div>
        <div className="row g-2"><DateRangeFilter filters={filters} setFilter={(k, v) => setFilters((f) => ({ ...f, [k]: v }))} /></div>
      </div>

      <div className="row g-3 mb-3">
        <Kpi label="Total Customers" value={c.totalCustomers} icon="people" color="primary" to="/customers" />
        <Kpi label="Total Leads" value={c.totalLeads} icon="funnel" color="info" to="/leads" />
        <Kpi label="Open Leads" value={c.openLeads} icon="funnel-fill" color="info" to="/leads" />
        <Kpi label="Total Opportunities" value={c.totalOpportunities} icon="briefcase" color="secondary" to="/opportunities" />
        <Kpi label="Open Opportunities" value={c.openOpportunities} icon="hourglass-split" color="warning" to="/pipeline" />
        <Kpi label="Won Opportunities" value={c.wonOpportunities} icon="trophy" color="success" to="/opportunities" />
        <Kpi label="Lost Opportunities" value={c.lostOpportunities} icon="x-octagon" color="danger" to="/opportunities" />
        <Kpi label="Total Pipeline Value" value={fmtMoney(c.totalPipelineValue)} icon="currency-rupee" color="primary" to="/pipeline" />
        <Kpi label="Weighted Pipeline" value={fmtMoney(c.weightedPipelineValue)} icon="graph-up" color="primary" to="/reports" />
        <Kpi label="Won Value" value={fmtMoney(c.wonValue)} icon="cash-stack" color="success" to="/reports" />
        <Kpi label="Pending Follow-Ups" value={c.pendingFollowUps} icon="calendar-event" color="info" to="/followups" />
        <Kpi label="Overdue Follow-Ups" value={c.overdueFollowUps} icon="exclamation-triangle" color="danger" to="/followups" />
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-4"><div className="card h-100"><div className="card-body">
          <h2 className="h6">Lead Status</h2>
          <Doughnut data={{ labels: ch.leadStatus.map((s) => s.status), datasets: [{ data: ch.leadStatus.map((s) => s.count), backgroundColor: COLORS }] }} options={{ plugins: { legend: { position: 'bottom' } } }} />
        </div></div></div>
        <div className="col-lg-4"><div className="card h-100"><div className="card-body">
          <h2 className="h6">Opportunity Pipeline</h2>
          <Bar data={{ labels: ch.opportunityPipeline.map((s) => s.stage), datasets: [{ label: 'Amount (₹)', data: ch.opportunityPipeline.map((s) => s.amount), backgroundColor: ['#6c757d', '#0dcaf0', '#ffc107', '#198754', '#dc3545'] }] }}
            options={{ plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => `Count: ${ch.opportunityPipeline[ctx.dataIndex].count}` } } } }} />
        </div></div></div>
        <div className="col-lg-4"><div className="card h-100"><div className="card-body">
          <h2 className="h6">Monthly Sales (Won vs Lost)</h2>
          <Bar data={{ labels: ch.monthlySales.map((m) => m.month), datasets: [
            { label: 'Won ₹', data: ch.monthlySales.map((m) => m.wonAmount), backgroundColor: '#198754' },
            { label: 'Lost ₹', data: ch.monthlySales.map((m) => m.lostAmount), backgroundColor: '#dc3545' }
          ] }} options={{ plugins: { legend: { position: 'bottom' } } }} />
        </div></div></div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6"><div className="card h-100"><div className="card-body">
          <h2 className="h6">Upcoming Follow-Ups</h2>
          {data.upcomingFollowUps.length === 0 ? <p className="text-muted small">Nothing scheduled.</p> : (
            <ul className="list-group list-group-flush">{data.upcomingFollowUps.map((f) => (
              <li key={f.id} className="list-group-item px-0 d-flex justify-content-between"><div><div>{f.subject}</div><small className="text-muted">{f.relatedType}: {f.relatedName} · {f.assignedTo?.name}</small></div><small>{fmtDateTime(f.followUpDate)}</small></li>
            ))}</ul>
          )}
        </div></div></div>
        <div className="col-lg-6"><div className="card h-100"><div className="card-body">
          <h2 className="h6">Recent Activities</h2>
          {data.recentActivities.length === 0 ? <p className="text-muted small">No activity yet.</p> : (
            <ul className="list-group list-group-flush">{data.recentActivities.map((a) => (
              <li key={a.id} className="list-group-item px-0 d-flex justify-content-between"><div><Badge value={a.activityType} /> {a.subject}<br /><small className="text-muted">{a.customer?.name || a.lead?.name} · {a.assignedTo?.name}</small></div><small>{fmtDate(a.activityDate)}</small></li>
            ))}</ul>
          )}
        </div></div></div>

        {data.teamPerformance && (
          <div className="col-12"><div className="card"><div className="card-body">
            <h2 className="h6">Team Performance</h2>
            <div className="table-responsive"><table className="table table-sm">
              <thead><tr><th>User</th><th>Role</th><th>Leads</th><th>Converted</th><th>Open Opps</th><th>Won</th><th>Lost</th><th>Open Amount</th><th>Won Amount</th></tr></thead>
              <tbody>{data.teamPerformance.map((t) => (
                <tr key={t.userId}><td>{t.name}</td><td><Badge value={t.role} /></td><td>{t.leads}</td><td>{t.convertedLeads}</td><td>{t.open}</td><td>{t.won}</td><td>{t.lost}</td><td>{fmtMoney(t.openAmount)}</td><td>{fmtMoney(t.wonAmount)}</td></tr>
              ))}</tbody>
            </table></div>
          </div></div></div>
        )}

        {data.security && (
          <div className="col-12"><div className="card"><div className="card-body">
            <h2 className="h6">Security & Users</h2>
            <div className="row text-center mb-3">
              {[['Total Users', data.security.totalUsers], ['Active Users', data.security.activeUsers], ['Locked Accounts', data.security.lockedUsers], ['Logins (7d)', data.security.loginsLast7Days], ['Failed Logins (7d)', data.security.failedLoginsLast7Days]].map(([l, v]) => (
                <div key={l} className="col"><div className="fs-4 fw-semibold">{v}</div><small className="text-muted">{l}</small></div>
              ))}
            </div>
            <table className="table table-sm"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Module</th><th>Result</th></tr></thead>
              <tbody>{data.security.recentAudit.map((a) => <tr key={a.id}><td>{fmtDateTime(a.createdDate)}</td><td>{a.userName}</td><td>{a.action}</td><td>{a.entityName}</td><td><Badge value={a.result} /></td></tr>)}</tbody>
            </table>
            <Link to="/audit" className="small">View full audit log →</Link>
          </div></div></div>
        )}
      </div>
    </>
  );
}
