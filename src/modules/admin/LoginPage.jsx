// UC01 Login: staff sign in with their email and password before viewing or managing tickets.
// After signing in they go back to the staff page they asked for, or to the dashboard.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ROLE_NAMES, useStaff } from '../../shared/staff.jsx';
import PageHero from '../../shared/PageHero.jsx';
import usePageTitle from '../../shared/usePageTitle.js';

// Supabase's messages, in plain words.
function explain(err) {
  const m = err?.message || '';
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password. Please check them and try again.';
  if (/email not confirmed/i.test(m)) return 'This email has not been confirmed yet. Open the link in the confirmation email first.';
  if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your connection and try again.';
  return m || 'Could not sign in. Please try again.';
}

export default function LoginPage() {
  usePageTitle('Staff sign in');
  const { ready, staff, signIn } = useStaff();
  const navigate = useNavigate();
  const { state } = useLocation();
  const to = state?.from || '/admin';

  const [v, setV] = useState({ email: '', password: '' });
  const [errs, setErrs] = useState({});
  const [formErr, setFormErr] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already signed in as staff: nothing to do here.
  if (ready && staff && !busy) return <Navigate to={to} replace />;

  const field = (k) => ({
    value: v[k],
    onChange: (e) => { setV({ ...v, [k]: e.target.value }); if (errs[k]) setErrs({ ...errs, [k]: '' }); setFormErr(''); },
  });

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) next.email = 'Enter your staff email, for example name@example.com.';
    if (!v.password) next.password = 'Enter your password.';
    setErrs(next);
    if (Object.keys(next).length) {
      document.getElementById(next.email ? 'le' : 'lp').focus();
      return;
    }
    setBusy(true); setFormErr('');
    try {
      await signIn(v.email, v.password);
      navigate(to, { replace: true });
    } catch (err) {
      console.error(err);
      setFormErr(explain(err));
      setBusy(false);
    }
  };

  return (
    <section>
      <PageHero kicker="Staff" title="Staff sign in" sub="For the construction team, government officers and admins. Residents do not need an account." />
      <div className="row r3">
        <form className="card stack" noValidate onSubmit={submit} aria-describedby={formErr ? 'lf-err' : undefined}>
          <div>
            <label htmlFor="le">Email</label>
            <input id="le" className="in" type="email" autoComplete="username" inputMode="email" spellCheck={false}
              aria-invalid={!!errs.email} aria-describedby={errs.email ? 'le-err' : undefined} {...field('email')} />
            {errs.email && <p className="err" id="le-err">{errs.email}</p>}
          </div>
          <div>
            <label htmlFor="lp">Password</label>
            <div className="pw">
              <input id="lp" className="in" type={show ? 'text' : 'password'} autoComplete="current-password"
                aria-invalid={!!errs.password} aria-describedby={errs.password ? 'lp-err' : undefined} {...field('password')} />
              <button type="button" className="pw-btn" aria-pressed={show} aria-controls="lp" onClick={() => setShow(!show)}>
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            {errs.password && <p className="err" id="lp-err">{errs.password}</p>}
          </div>
          {formErr && <p className="err" id="lf-err" role="alert">{formErr}</p>}
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }} disabled={busy || !ready}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="card">
          <h2>Who can sign in</h2>
          <p>Staff accounts are created by an admin and have one of these roles:</p>
          <ul className="roles">{Object.values(ROLE_NAMES).map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="mut">Want to follow a complaint you reported? You don&apos;t need to sign in: use your ticket number on the Feedback page.</p>
        </div>
      </div>
    </section>
  );
}
