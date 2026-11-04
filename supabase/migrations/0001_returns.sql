create function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;
create table cases (
 id uuid primary key default gen_random_uuid(), code text not null unique,
 retailer text not null, rma text not null, order_number text not null, customer text not null,
 country text not null check(country in ('NZ','AU','unknown')), currency text not null check(currency ~ '^[A-Z]{3}$'),
 owner text not null, opened_on date not null, due date not null, retention_due date not null,
 status text not null default 'open' check(status in ('open','closed','cancelled')),
 source_status text not null default '', source_method text not null default '',
 source_digest text, raw jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(retailer,rma), check(due>=opened_on)
);
create table items (
 id uuid primary key default gen_random_uuid(), code text not null unique, case_id uuid not null references cases,
 source_item text not null, sku text not null, quantity integer not null check(quantity between 1 and 100000),
 unit_cents bigint check(unit_cents between 0 and 9000000000), reason text not null,
 requested text not null check(requested in ('return','exchange','unknown')), exchange_sku text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(case_id,source_item)
);
create table receipts (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items,
 reference text not null unique, quantity integer not null check(quantity>0), received_on date not null,
 actor text not null, note text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table inspections (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items,
 quantity integer not null check(quantity>0), grade text not null check(grade in ('sellable','damaged','unsafe')),
 disposition text not null check(disposition in ('restock','quarantine','repair','recycle')),
 evidence text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(grade<>'unsafe' or disposition='quarantine'), check(grade='sellable' or disposition<>'restock')
);
create table assessments (
 id uuid primary key default gen_random_uuid(), item_id uuid not null references items,
 basis text not null check(basis in ('consumer_guarantee','change_of_mind','other')),
 severity text not null check(severity in ('major','minor','none','unknown')),
 customer_choice text not null check(customer_choice in ('refund','exchange','repair','store_credit','none','unknown')),
 evidence text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table resolutions (
 id uuid primary key default gen_random_uuid(), item_id uuid not null unique references items,
 assessment_id uuid not null references assessments,
 remedy text not null check(remedy in ('refund','exchange','repair','store_credit','decline')),
 amount_cents bigint check(amount_cents between 0 and 9000000000000),
 rationale text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table completions (
 id uuid primary key default gen_random_uuid(), resolution_id uuid not null unique references resolutions,
 external_reference text not null, note text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table notes (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references cases, note text not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), digest text not null unique, source_text text not null,
 counts jsonb not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), command text not null, actor text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function append_only() returns trigger language plpgsql as $$ begin raise exception 'Append-only evidence'; end $$;
do $$ declare t text; begin
 foreach t in array array['cases','items','receipts','inspections','assessments','resolutions','completions','notes','imports','activity'] loop
 execute format('create trigger touch_updated before update on %I for each row execute function touch_updated_at()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
 foreach t in array array['receipts','inspections','assessments','resolutions','completions','notes','imports','activity'] loop
 execute format('create trigger immutable before update or delete on %I for each row execute function append_only()',t);
 end loop;
end $$;
create index on items(case_id); create index on receipts(item_id); create index on inspections(item_id);
create index on assessments(item_id,created_at); create index on cases(status,due);
create view item_balance as
select i.*,c.code as case_code,c.customer,c.country,c.currency,c.owner,c.due,c.status as case_status,
 coalesce((select sum(r.quantity)::int from receipts r where r.item_id=i.id),0) as received,
 coalesce((select sum(x.quantity)::int from inspections x where x.item_id=i.id),0) as inspected,
 (select a.id from assessments a where a.item_id=i.id order by a.created_at desc,a.id desc limit 1) as assessment_id,
 (select r.id from resolutions r where r.item_id=i.id) as resolution_id,
 (select x.external_reference from completions x join resolutions r on r.id=x.resolution_id where r.item_id=i.id) as completion
from items i join cases c on c.id=i.case_id;
create view return_queue as
select c.id,c.code,c.customer,c.owner,c.country,c.currency,c.opened_on,c.due,c.status,
 count(i.id)::int as lines,coalesce(sum(i.quantity),0)::int as units,
 coalesce(sum(i.quantity-i.received),0)::int as awaiting_receipt,
 coalesce(sum(i.received-i.inspected),0)::int as awaiting_inspection,
 count(i.id) filter(where i.resolution_id is null)::int as undecided,
 count(i.id) filter(where i.resolution_id is not null and i.completion is null)::int as awaiting_completion,
 case when c.status<>'open' then c.status when c.due<current_date then 'overdue' else 'on schedule' end as attention
from cases c left join item_balance i on i.case_id=c.id group by c.id;
create view decision_queue as
select i.code,i.case_code,i.sku,i.customer,i.owner,i.currency,r.id,r.remedy,r.amount_cents,r.rationale,x.external_reference,
 case when x.id is null then 'confirm outside this system' else 'recorded complete' end as attention
from resolutions r join item_balance i on i.id=r.item_id left join completions x on x.resolution_id=r.id;
create view reason_summary as
select sku,reason,requested,count(*)::int as lines,sum(quantity)::int as units,
 sum(received)::int as received,sum(inspected)::int as inspected
from item_balance group by sku,reason,requested;
create view compliance_findings as
select i.code,i.case_code,i.sku,'REVIEW-ASSESSMENT' as rule,'Record human assessment before remedy' as finding
from item_balance i where i.assessment_id is null and i.case_status='open'
union all
select i.code,i.case_code,i.sku,'REVIEW-JURISDICTION','Confirm governing consumer rights'
from item_balance i where i.country='unknown' and i.case_status='open'
union all
select i.code,i.case_code,i.sku,'REVIEW-SEVERITY','Consumer guarantee severity needs human review'
from item_balance i join assessments a on a.id=i.assessment_id where a.basis='consumer_guarantee' and a.severity='unknown' and i.case_status='open'
union all
select i.code,i.case_code,i.sku,'AU-NZ-CHOICE','Record customer choice for major defect'
from item_balance i join assessments a on a.id=i.assessment_id where a.basis='consumer_guarantee' and a.severity='major' and a.customer_choice in ('none','unknown') and i.case_status='open'
union all
select i.code,i.case_code,i.sku,'AU-NZ-REMEDY','Review remedy against recorded customer choice'
from item_balance i join assessments a on a.id=i.assessment_id join resolutions r on r.item_id=i.id
where a.basis='consumer_guarantee' and a.severity='major' and r.remedy<>a.customer_choice
union all
select i.code,i.case_code,i.sku,'SAFETY-HOLD','Unsafe goods remain quarantined; review handling'
from item_balance i where exists(select 1 from inspections x where x.item_id=i.id and x.grade='unsafe')
union all
select c.code,c.code,'' as sku,'NZ-IPP9','Review continued need for personal return records'
from cases c where c.retention_due<current_date;
revoke all on item_balance,return_queue,decision_queue,reason_summary,compliance_findings from public;
