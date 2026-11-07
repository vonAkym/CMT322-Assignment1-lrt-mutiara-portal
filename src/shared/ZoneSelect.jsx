// Area dropdown filled from the zones table. The zone list is fetched once and shared by every dropdown.
// all="All areas" adds a first option with an empty value; leave it out to force a choice.
import { useEffect, useState } from 'react';
import { listZones } from './supabase.js';

let cache = null;
function loadZones() {
  if (!cache) cache = listZones().catch((e) => { console.error(e); cache = null; return []; });
  return cache;
}

export function useZones() {
  const [zones, setZones] = useState([]);
  useEffect(() => { let live = true; loadZones().then((z) => { if (live) setZones(z); }); return () => { live = false; }; }, []);
  return zones;
}

export default function ZoneSelect({ all, value, onChange, ...props }) {
  const zones = useZones();
  return (
    <select className="in" value={value} onChange={(e) => onChange(e.target.value, e)} {...props}>
      {all && <option value="">{all}</option>}
      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
    </select>
  );
}
