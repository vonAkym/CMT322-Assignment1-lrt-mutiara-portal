-- Sample data for development. Roads, stations and dates are examples only.
insert into public.zones (name) values ('George Town'), ('Komtar'), ('Bayan Lepas')
on conflict (name) do nothing;

insert into public.updates (title, body, zone_id, category, status, is_urgent, approved) values
 ('Lane closure at Sample Road A', 'Pedestrians use the covered walkway on the east side.', (select id from public.zones where name='George Town'), 'Road closure', 'Ongoing', true, true),
 ('Piling works notice', 'Noisy works between 9 am and 5 pm. Shop access stays open.', (select id from public.zones where name='Komtar'), 'Schedule', 'Planned', false, true),
 ('Pedestrian crossing reopened', 'Posted by the construction team.', (select id from public.zones where name='George Town'), 'Progress', 'Completed', false, true),
 ('Temporary shop entrance', 'Use the side street entrance. Delivery hours: 7 am to 10 am.', (select id from public.zones where name='Bayan Lepas'), 'Business access', 'Ongoing', false, true);

insert into public.map_features (kind, name, status, detail, lat, lng, starts_on, ends_on) values
 ('station','Bayan Lepas','Station','Sample station at the southern end.',5.2950,100.2600,null,null),
 ('station','Komtar','Station','Sample station in the city centre.',5.4146,100.3292,null,null),
 ('station','Penang Sentral','Station','Sample station at the northern end.',5.3990,100.3900,null,null),
 ('closure','Sample Road A','Closed','Use the detour beside it.',5.4130,100.3280,current_date,current_date + 10),
 ('closure','Sample Road B','Partly closed','One lane stays open.',5.4160,100.3310,current_date + 4,current_date + 14),
 ('walk','Covered walkway','Open','Pedestrian route beside the works.',5.4140,100.3300,current_date,current_date + 14),
 ('biz','Sample Shop entrance','Open','Enter from the side street.',5.4135,100.3285,current_date,current_date + 14),
 ('detour','Detour for Sample Road A','Open','Light vehicles use this route.',5.4125,100.3270,current_date,current_date + 10);
