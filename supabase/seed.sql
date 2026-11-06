-- Sample data for development. Roads, stations and dates are examples only.
insert into public.zones (name) values ('George Town'), ('Komtar'), ('Bayan Lepas')
on conflict (name) do nothing;

-- Sample advisories are in seed_advisories.sql (run it after the advisories migration).

insert into public.map_features (kind, name, status, detail, lat, lng, starts_on, ends_on) values
 ('station','Bayan Lepas','Station','Sample station at the southern end.',5.2950,100.2600,null,null),
 ('station','Komtar','Station','Sample station in the city centre.',5.4146,100.3292,null,null),
 ('station','Penang Sentral','Station','Sample station at the northern end.',5.3990,100.3900,null,null),
 ('closure','Sample Road A','Closed','Use the detour beside it.',5.4130,100.3280,current_date,current_date + 10),
 ('closure','Sample Road B','Partly closed','One lane stays open.',5.4160,100.3310,current_date + 4,current_date + 14),
 ('walk','Covered walkway','Open','Pedestrian route beside the works.',5.4140,100.3300,current_date,current_date + 14),
 ('biz','Sample Shop entrance','Open','Enter from the side street.',5.4135,100.3285,current_date,current_date + 14),
 ('detour','Detour for Sample Road A','Open','Light vehicles use this route.',5.4125,100.3270,current_date,current_date + 10);
