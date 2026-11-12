// Zone alerts: a visitor leaves an email address to hear about advisories in one area.
// The address is saved in the subscriptions table. Sending the emails needs a mail service, which this project does not have yet,
// so this box is not shown on any page for now (it was on the Advisories page). The table and saved sign-ups are kept.
import { useState } from 'react';
import ZoneSelect, { useZones } from '../../shared/ZoneSelect.jsx';
import { subscribeToZone, isEmail } from './api.js';

export default function ZoneAlerts() {
  const zones = useZones();
  const [zone, setZone] = useState('');
  const [email, setEmail] = useState('');
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState(null); // { ok, text } after a try
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const problems = {};
    if (!zone) problems.zone = 'Choose an area.';
    if (!isEmail(email)) problems.email = 'Enter an email address, e.g. name@example.com.';
    setErrs(problems);
    setMsg(null);
    if (problems.zone || problems.email) { document.getElementById(problems.zone ? 'sz' : 'se').focus(); return; }

    const area = (zones.find((z) => String(z.id) === zone) || {}).name || 'this area';
    const address = email.trim();
    setSending(true);
    try {
      const result = await subscribeToZone(zone, address);
      setMsg({ ok: true, text: result === 'already' ? `${address} is already subscribed to ${area}.` : `Subscribed. Alerts for ${area} will go to ${address}.` });
      setEmail('');
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: 'Could not subscribe. Please try again later.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="stack" noValidate onSubmit={submit} aria-labelledby="zah">
      <h2 id="zah">Alert me about an area</h2>
      <div>
        <label htmlFor="sz">Area</label>
        <ZoneSelect id="sz" all="Choose an area" value={zone} onChange={setZone}
          aria-invalid={!!errs.zone} aria-describedby={errs.zone ? 'sze' : undefined} />
        {errs.zone && <p className="err" id="sze">{errs.zone}</p>}
      </div>
      <div>
        <label htmlFor="se">Email</label>
        <input id="se" className="in" type="email" autoComplete="email" placeholder="name@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errs.email} aria-describedby={errs.email ? 'see' : undefined} />
        {errs.email && <p className="err" id="see">{errs.email}</p>}
      </div>
      <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }} disabled={sending}>{sending ? 'Subscribing…' : 'Subscribe'}</button>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </form>
  );
}
