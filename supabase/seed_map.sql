-- Sample map features for Module 2 (the disruption map). Roads, businesses and dates are examples only,
-- and the positions are approximate: they were typed in, not traced on the map.
-- To put a feature exactly on its road, sign in as staff, open the map page, press "Edit the map" and drag it.
--
-- Run after seed.sql and seed_advisories.sql. Safe to run again: it removes every map feature first.
-- Run it again after re-running seed_advisories.sql, which unlinks the features from their advisories.
-- Stations are not stored here any more: the map draws them from src/modules/map/line.js.
delete from public.map_features;

-- path is a list of [latitude, longitude] points. lat and lng are where the marker sits.
insert into public.map_features (kind, name, status, detail, lat, lng, path, starts_on, ends_on) values
 ('closure', 'Sample Road A', 'Closed',
  'Closed to all traffic while the station foundations are built. Use the detour beside it.',
  5.41290, 100.32960, '[[5.41275,100.32840],[5.41290,100.32960],[5.41310,100.33080]]',
  current_date - 2, current_date + 8),
 ('detour', 'Detour for Sample Road A', 'Open',
  'Light vehicles follow this route while Sample Road A is closed.',
  5.41200, 100.32950, '[[5.41275,100.32840],[5.41190,100.32880],[5.41215,100.33020],[5.41310,100.33080]]',
  current_date - 2, current_date + 8),
 ('walk', 'Covered walkway', 'Open',
  'Pedestrian route beside the works. Step-free and lit at night.',
  5.41350, 100.32975, '[[5.41300,100.32960],[5.41350,100.32975],[5.41400,100.32990]]',
  current_date - 1, current_date + 14),
 ('biz', 'Sample Shop entrance', 'Open',
  'Enter from the side street. Delivery access 7 am to 10 am.',
  5.41330, 100.33040, null,
  current_date - 2, current_date + 8),
 ('closure', 'Sample Road B', 'Partly closed',
  'One lane stays open in each direction at night. Expect delays.',
  5.40775, 100.33280, '[[5.40830,100.33180],[5.40775,100.33280],[5.40720,100.33380]]',
  current_date + 4, current_date + 14),
 ('closure', 'Sample Road C', 'Closed',
  'Closed at night for resurfacing. Reopens before the morning peak.',
  5.32150, 100.28800, '[[5.32220,100.28680],[5.32150,100.28800],[5.32080,100.28920]]',
  current_date + 6, current_date + 7);

-- Link each feature to its advisory (Module 1), so the map can show work hours and a link to the full advisory.
update public.map_features m set update_id = u.id
from public.updates u
where (m.name, u.title) in (
  ('Sample Road A', 'Full closure of Sample Road A'),
  ('Detour for Sample Road A', 'Full closure of Sample Road A'),
  ('Sample Road B', 'Partial lane closure on Sample Road B'),
  ('Sample Shop entrance', 'Temporary entrance for Sample Shop'),
  ('Covered walkway', 'Covered walkway open beside the works'),
  ('Sample Road C', 'Night resurfacing on Sample Road C'));
