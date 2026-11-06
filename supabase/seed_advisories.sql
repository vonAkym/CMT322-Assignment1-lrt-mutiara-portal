-- Sample advisories for Module 1. Roads, businesses and dates are examples only.
-- Run after seed.sql and the 20261108000000_advisories migration. Safe to run again:
-- it removes every advisory first (map features linked to them are kept, just unlinked).
-- Photos are real Mutiara Line construction photos from Wikimedia Commons, see assets/img/CREDITS.md.
delete from public.updates;

insert into public.updates
  (title, body, zone_id, category, status, severity, state, location, starts_on, ends_on, work_hours, detour, affected_businesses, photo_paths, updated_at)
values
 ('Full closure of Sample Road A',
  'Sample Road A is closed to all traffic while the station foundations are built. Pedestrians use the covered walkway on the east side.',
  (select id from public.zones where name = 'George Town'), 'Road closure', 'Ongoing', 'High', 'Published',
  'Sample Road A, between Sample Station B and the waterfront', current_date - 2, current_date + 8, '24 hours, every day',
  'Light vehicles follow the green detour signs on the west side. Lorries use Sample Road C.',
  'Sample Shop (entrance moved to the side street), two food stalls at the junction',
  array['assets/img/advisory-komtar-detour.jpg', 'assets/img/advisory-barriers.jpg'], now() - interval '3 hours'),

 ('Partial lane closure on Sample Road B',
  'One lane in each direction closes at night so that concrete barriers can be moved for the viaduct works.',
  (select id from public.zones where name = 'Komtar'), 'Road closure', 'Planned', 'Medium', 'Published',
  'Sample Road B, near Sample Station C', current_date + 4, current_date + 14, '10 pm to 6 am, nightly',
  'One lane stays open in each direction. Expect delays at peak hours.', null,
  array['assets/img/advisory-barriers.jpg'], now() - interval '1 day'),

 ('Bore piling works near Komtar station',
  'Piling rigs are drilling the station foundations. Expect noise and vibration during working hours. Shop access stays open.',
  (select id from public.zones where name = 'Komtar'), 'Schedule', 'Ongoing', 'Medium', 'Published',
  'Komtar station site', current_date - 5, current_date + 20, '9 am to 5 pm, Monday to Saturday',
  null, 'Shops on the ground floor facing the site',
  array['assets/img/advisory-piling.jpg'], now() - interval '2 days'),

 ('Temporary entrance for Sample Shop',
  'The front entrance is behind the works barrier. Customers enter from the side street, which stays open throughout.',
  (select id from public.zones where name = 'George Town'), 'Business access', 'Ongoing', 'Low', 'Published',
  'Sample Shop entrance, Sample Road A', current_date - 2, current_date + 8, 'Deliveries 7 am to 10 am',
  'Use the side street entrance.', 'Sample Shop',
  array['assets/img/advisory-footpath.jpg'], now() - interval '5 hours'),

 ('Covered walkway open beside the works',
  'A covered pedestrian route now runs beside the works on Sample Road A. It is step-free and lit at night.',
  (select id from public.zones where name = 'George Town'), 'Progress', 'Ongoing', 'Low', 'Published',
  'Covered walkway, east side of Sample Road A', current_date - 1, current_date + 14, 'Open 24 hours',
  null, null, '{}', now() - interval '1 day'),

 ('Viaduct pier works at Bayan Lepas',
  'Columns for the elevated track will be built along the main road. Work is mostly inside the fenced area.',
  (select id from public.zones where name = 'Bayan Lepas'), 'Schedule', 'Planned', 'Low', 'Published',
  'Main road near Bayan Lepas station', current_date + 9, current_date + 30, '8 am to 6 pm, Monday to Friday',
  null, null,
  array['assets/img/advisory-viaduct.jpg'], now() - interval '4 days'),

 ('Night resurfacing on Sample Road C',
  'The road is resurfaced after utility works. It reopens before the morning peak.',
  (select id from public.zones where name = 'Bayan Lepas'), 'Road closure', 'Planned', 'Medium', 'Published',
  'Sample Road C', current_date + 6, current_date + 7, '11 pm to 5 am',
  'Follow the signed detour through Sample Road D.', null, '{}', now() - interval '6 hours'),

 ('Pedestrian crossing reopened',
  'The crossing at Sample Station B is open again after the barriers were moved.',
  (select id from public.zones where name = 'George Town'), 'Progress', 'Completed', 'Low', 'Ended',
  'Sample Station B', current_date - 20, current_date - 3, null, null, null, '{}', now() - interval '3 days'),

 -- A draft, visible only to staff on the "My advisories" page.
 ('Utility relocation at Sample Road D',
  'Water pipes are moved ahead of the station works. Details to be confirmed.',
  (select id from public.zones where name = 'Komtar'), 'Schedule', 'Planned', 'Medium', 'Draft',
  'Sample Road D', current_date + 15, current_date + 25, null, null, null, '{}', now());

-- Link the matching map markers (Module 2) to their advisories.
update public.map_features m set update_id = u.id
from public.updates u
where (m.name, u.title) in (
  ('Sample Road A', 'Full closure of Sample Road A'),
  ('Detour for Sample Road A', 'Full closure of Sample Road A'),
  ('Sample Road B', 'Partial lane closure on Sample Road B'),
  ('Sample Shop entrance', 'Temporary entrance for Sample Shop'),
  ('Covered walkway', 'Covered walkway open beside the works'));
