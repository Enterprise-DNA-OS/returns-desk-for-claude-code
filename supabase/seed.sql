insert into cases(id,code,retailer,rma,order_number,customer,country,currency,owner,opened_on,due,retention_due)
values
 ('10000000-0000-0000-0000-000000000001','R-001','Demo Outdoor','DEMO-001','ORDER-101','Harbour Outfitters','NZ','NZD','Mia',current_date-21,current_date-7,current_date+180),
 ('10000000-0000-0000-0000-000000000002','R-002','Demo Outdoor','DEMO-002','ORDER-102','Southern Trail','AU','AUD','Tom',current_date-12,current_date-2,current_date+180),
 ('10000000-0000-0000-0000-000000000003','R-003','Demo Outdoor','DEMO-003','ORDER-103','Harbour Home','NZ','NZD','Mia',current_date-5,current_date+2,current_date-1)
on conflict do nothing;
insert into items(id,code,case_id,source_item,sku,quantity,unit_cents,reason,requested,exchange_sku) values
 ('20000000-0000-0000-0000-000000000001','I-001','10000000-0000-0000-0000-000000000001','1','JACKET-M',2,14900,'Zip failed','return',''),
 ('20000000-0000-0000-0000-000000000002','I-002','10000000-0000-0000-0000-000000000002','1','BOOT-42',1,22000,'Wrong size','exchange','BOOT-43'),
 ('20000000-0000-0000-0000-000000000003','I-003','10000000-0000-0000-0000-000000000003','1','LAMP-01',1,null,'Overheating','return','')
on conflict do nothing;
insert into receipts(id,item_id,reference,quantity,received_on,actor,note) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','DOCK-101',1,current_date-8,'Mia','One of two jackets received'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','DOCK-102',1,current_date-6,'Tom','Sealed boots received'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','DOCK-103',1,current_date-2,'Mia','Do not energise lamp')
on conflict do nothing;
insert into inspections(id,item_id,quantity,grade,disposition,evidence,actor) values
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,'sellable','restock','Unworn pair, box checked','Tom'),
 ('40000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003',1,'unsafe','quarantine','Heat damage at socket; isolated from sale stock','Mia')
on conflict do nothing;
insert into assessments(id,item_id,basis,severity,customer_choice,evidence,actor) values
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','change_of_mind','none','exchange','Size exchange requested under shop policy','Tom'),
 ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','consumer_guarantee','major','unknown','Operator assessed unsafe fault; customer choice still needed','Mia')
on conflict do nothing;
insert into resolutions(id,item_id,assessment_id,remedy,rationale,actor) values
 ('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002','exchange','Replacement size agreed; fulfilment confirmation pending','Tom')
on conflict do nothing;
