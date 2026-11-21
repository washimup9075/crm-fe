/**
 * Client-side validation (section 5.1): Required, Email, Phone, Length, Date
 * and Numeric rules. Mirrors the server rules; the server re-validates
 * everything because client checks can be bypassed.
 */
export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RX = /^[6-9]\d{9}$/;

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const empty = (v) => v === undefined || v === null || String(v).trim() === '';

/**
 * field rule options:
 *  required, email, phone, minLength, maxLength, min, max, gt (greater than),
 *  date, notPast (date >= today), integer, password, match (other field), custom(v, values)
 */
export function validateField(f, value, values = {}) {
  const label = f.label;
  if (f.required && empty(value)) return `${label} is required.`;
  if (empty(value)) return null;
  const s = String(value).trim();
  if (f.minLength && s.length < f.minLength) return `${label} must be at least ${f.minLength} characters.`;
  if (f.maxLength && s.length > f.maxLength) return `${label} cannot exceed ${f.maxLength} characters.`;
  if (f.email && !EMAIL_RX.test(s)) return 'Enter a valid email address.';
  if (f.phone && !PHONE_RX.test(s)) return 'Enter a valid phone number.';
  if (f.type === 'number' || f.numeric) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${label} must be a number.`;
    if (f.integer && !Number.isInteger(n)) return `${label} must be a whole number.`;
    if (f.gt !== undefined && !(n > f.gt)) return f.gtMessage || `${label} must be greater than ${f.gt}.`;
    if (f.min !== undefined && n < f.min) return f.rangeMessage || `${label} must be at least ${f.min}.`;
    if (f.max !== undefined && n > f.max) return f.rangeMessage || `${label} cannot exceed ${f.max}.`;
  }
  if (f.type === 'date' || f.type === 'datetime-local') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return `${label} must be a valid date.`;
    if (f.notPast && (typeof f.notPast === 'function' ? f.notPast(values) : true) && d < startOfToday()) return f.notPastMessage || `${label} cannot be in the past.`;
  }
  if (f.password) {
    if (s.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(s)) return 'Password must contain at least one uppercase letter.';
    if (!/[a-z]/.test(s)) return 'Password must contain at least one lowercase letter.';
    if (!/\d/.test(s)) return 'Password must contain at least one digit.';
    if (!/[^A-Za-z0-9]/.test(s)) return 'Password must contain at least one special character.';
  }
  if (f.match && value !== values[f.match]) return 'Passwords do not match.';
  if (f.custom) return f.custom(value, values) || null;
  return null;
}

export function validateAll(fields, values) {
  const errors = {};
  fields.forEach((f) => {
    if (f.hidden && f.hidden(values)) return;
    const e = validateField(f, values[f.name], values);
    if (e) errors[f.name] = e;
  });
  return errors;
}
