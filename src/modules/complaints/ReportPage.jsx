// Report page: sends a concern to the database and shows the ticket number.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { isPhotoOk } from '../../shared/supabase.js';
import { submitTicket } from './api.js';
import { trackUrl } from './TrackPage.jsx';

const CATEGORIES = ['Noise', 'Dust', 'Road damage', 'Safety hazard', 'Blocked access', 'Other'];

// Address of this page with the location already filled in, e.g. from the map or an advisory.
export const reportUrl = (location) => (location ? `/report?location=${encodeURIComponent(location)}` : '/report');

export default function ReportPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef(null);
  const blank = { category: CATEGORIES[0], description: '', location: params.get('location') || '', name: '', anonymous: false };
  const [v, setV] = useState(blank);
  const [descErr, setDescErr] = useState(false);
  const [photoErr, setPhotoErr] = useState('');
  const [sending, setSending] = useState(false);
  const [ticket, setTicket] = useState('');

  // Opening the page again from another marker or advisory fills in the new location.
  useEffect(() => { setV((x) => ({ ...x, location: params.get('location') || '' })); }, [params]);

  const field = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });

  const submit = async (e) => {
    e.preventDefault();
    // The database needs 5 to 2000 characters, so check that here first.
    const d = v.description.trim(), file = fileRef.current.files[0];
    let ok = true;
    setDescErr(d.length < 5); if (d.length < 5) ok = false;
    setPhotoErr('');
    if (file && !isPhotoOk(file)) { setPhotoErr('Photo must be a JPG or PNG up to 5 MB.'); ok = false; }
    if (!ok) return;
    setSending(true);
    try {
      setTicket(await submitTicket({ ...v, description: d, file }));
      setV({ ...blank, location: '' });
      fileRef.current.value = '';
    } catch (err) {
      console.error(err);
      setPhotoErr(`Could not send your concern: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <section>
      <h1>Report a concern</h1>
      <div className="row r3">
        <form className="card stack" noValidate onSubmit={submit}>
          <div><label htmlFor="rc">Category</label><select id="rc" className="in" {...field('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label htmlFor="rd">Describe the issue</label><textarea id="rd" className="in" rows={4} maxLength={2000} placeholder="What happened and when?" {...field('description')} />
            {descErr && <p className="err">Please describe the issue (at least 5 characters).</p>}</div>
          <div><label htmlFor="rl">Location</label><input id="rl" className="in" placeholder="Street or landmark" {...field('location')} /></div>
          <div><label htmlFor="rp">Photo (JPG or PNG, up to 5 MB)</label><input id="rp" ref={fileRef} type="file" accept="image/jpeg,image/png" className="in" />
            {photoErr && <p className="err">{photoErr}</p>}</div>
          <div><label htmlFor="rn">Your name (optional)</label><input id="rn" className="in" {...field('name')} /></div>
          <label style={{ fontWeight: 400 }}><input type="checkbox" checked={v.anonymous} onChange={(e) => setV({ ...v, anonymous: e.target.checked })} /> Submit without my name</label>
          <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }} disabled={sending}>{sending ? 'Sending…' : 'Submit concern'}</button>
        </form>
        <div className="stack">
          <div className="card"><h2>What happens next</h2><p>1. You submit the concern.<br />2. You receive a ticket number.<br />3. The team reviews and replies.<br />4. You track progress with your ticket number.</p></div>
          {ticket && (
            <div className="ok" role="status">
              <b>Your ticket number</b>
              <div style={{ fontSize: 24, fontWeight: 600 }}>{ticket}</div>
              <p>Keep it to track your concern.</p>
              <button className="btn s" type="button" style={{ marginTop: 10 }} onClick={() => navigate(trackUrl(ticket))}>Track this ticket</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
