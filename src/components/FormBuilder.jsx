import { useState } from 'react';
import { validateAll, validateField } from '../utils/validation';
import { parseError } from '../utils/api';

/**
 * Config-driven form with inline client-side validation (on blur + on submit).
 * Server-side validation errors returned by the API are mapped back onto the
 * same fields, so a bypassed browser check still shows a message per field.
 */
export default function FormBuilder({ fields, initial = {}, onSubmit, submitLabel = 'Save', onCancel, children }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === 'checkbox' ? false : '')])));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const visible = fields.filter((f) => !(f.hidden && f.hidden(values)));
  const set = (name, v) => setValues((s) => ({ ...s, [name]: v }));
  const blur = (f) => setErrors((e) => ({ ...e, [f.name]: validateField(f, values[f.name], values) }));

  const submit = async (ev) => {
    ev.preventDefault();
    setFormError('');
    const errs = validateAll(visible, values);
    setErrors(errs);
    if (Object.keys(errs).length) { setFormError('Please correct the highlighted fields.'); return; }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (err) {
      const { message, fieldErrors } = parseError(err);
      setErrors(fieldErrors);
      setFormError(message);
    } finally { setSaving(false); }
  };

  const input = (f) => {
    const id = `f-${f.name}`;
    const cls = `form-control${errors[f.name] ? ' is-invalid' : ''}`;
    const common = { id, name: f.name, value: values[f.name] ?? '', onChange: (e) => set(f.name, e.target.value), onBlur: () => blur(f), disabled: f.disabled, 'aria-invalid': !!errors[f.name], 'aria-describedby': `${id}-err` };
    if (f.type === 'select') {
      return (
        <select {...common} className={`form-select${errors[f.name] ? ' is-invalid' : ''}`}>
          <option value="">{f.placeholder || `Select ${f.label}`}</option>
          {(typeof f.options === 'function' ? f.options(values) : f.options || []).map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return <option key={opt.value} value={opt.value}>{opt.label}</option>;
          })}
        </select>
      );
    }
    if (f.type === 'textarea') return <textarea {...common} rows={f.rows || 3} className={cls} maxLength={f.maxLength} />;
    if (f.type === 'checkbox') {
      return (
        <div className="form-check mt-2">
          <input id={id} type="checkbox" className="form-check-input" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} />
          <label htmlFor={id} className="form-check-label">{f.checkLabel || f.label}</label>
        </div>
      );
    }
    return <input {...common} type={f.type || 'text'} className={cls} maxLength={f.maxLength} min={f.minAttr} step={f.step} autoComplete={f.autoComplete} placeholder={f.placeholder} />;
  };

  return (
    <form onSubmit={submit} noValidate>
      {formError && <div className="alert alert-danger py-2" role="alert">{formError}</div>}
      <div className="row g-3">
        {visible.map((f) => (
          <div key={f.name} className={f.col || 'col-md-6'}>
            {f.type !== 'checkbox' && <label htmlFor={`f-${f.name}`} className="form-label">{f.label}{f.required && <span className="text-danger"> *</span>}</label>}
            {input(f)}
            {f.help && !errors[f.name] && <div className="form-text">{f.help}</div>}
            <div id={`f-${f.name}-err`} className="invalid-feedback d-block">{errors[f.name]}</div>
          </div>
        ))}
      </div>
      {children}
      <div className="mt-4 d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
