import axios from 'axios';

/**
 * Axios instance. The session lives in an httpOnly cookie; axios echoes the
 * XSRF-TOKEN cookie in the X-XSRF-TOKEN header on every request (anti-forgery).
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN'
});

export const initCsrf = () => api.get('/auth/csrf');

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';
    if (status === 401 && onUnauthorized && !url.startsWith('/auth/')) onUnauthorized();
    if (status === 403 && err.response?.data?.error?.code === 'PASSWORD_CHANGE_REQUIRED') window.location.assign('/change-password');
    return Promise.reject(err);
  }
);

/** User-friendly message + field errors from the server's consistent error object. */
export function parseError(err) {
  const e = err?.response?.data?.error;
  const fieldErrors = {};
  (e?.details || []).forEach((d) => { if (d.field && !fieldErrors[d.field]) fieldErrors[d.field] = d.message; });
  return { message: e?.message || 'Something went wrong. Please try again.', fieldErrors };
}

export const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const toInputDateTime = (d) => {
  if (!d) return '';
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const todayStr = () => toInputDate(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));

export default api;
