#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';

export const reads={
 'returns':"select code,customer,owner,country,currency,due,status,awaiting_receipt,awaiting_inspection,undecided,awaiting_completion from return_queue order by due,code",
 'attention':"select code,owner,attention,awaiting_receipt,awaiting_inspection,awaiting_completion from return_queue where status='open' and (due<current_date or awaiting_inspection>0 or awaiting_completion>0) order by due,code",
 'receiving':"select code,case_code,sku,quantity,received,quantity-received as outstanding,owner from item_balance where case_status='open' and received<quantity order by due,code",
 'inspection-queue':"select code,case_code,sku,received,inspected,received-inspected as to_inspect,owner from item_balance where case_status='open' and received>inspected order by due,code",
 'dispositions':"select i.code,i.case_code,i.sku,x.quantity,x.grade,x.disposition,x.evidence,x.actor from inspections x join item_balance i on i.id=x.item_id order by i.code,x.created_at",
 'reasons':"select * from reason_summary order by units desc,sku,reason",
 'decisions':"select code,case_code,sku,owner,currency,remedy,amount_cents,attention,external_reference from decision_queue order by case_code,code",
 'compliance':"select * from compliance_findings order by case_code,code,rule",
 'value-at-risk':"select currency,sum(quantity*unit_cents) as known_goods_cents,count(*) filter(where unit_cents is null)::int as unknown_value_lines,sum(quantity)::int as units from item_balance where case_status='open' group by currency order by currency",
 'history':"select command,actor,detail,created_at from activity order by created_at,id",
};
export const usage={
 ...Object.fromEntries(Object.keys(reads).map(k=>[k,`${k} [--json]`])),
 'case':'case <code|name|id-prefix>',
 'item':'item <code|sku|id-prefix>',
 'add':'add --code= --retailer= --rma= --order= --customer= --country=NZ|AU|unknown --currency=NZD --owner= --opened=YYYY-MM-DD --due=YYYY-MM-DD --retention-due=YYYY-MM-DD --actor=',
 'add-item':'add-item <case> --code= --sku= --quantity= --reason= --requested=return|exchange|unknown [--unit-price=] [--exchange-sku=] --actor=',
 'receive':'receive <item> --quantity= --reference= --date=YYYY-MM-DD --note= --actor=',
 'inspect':'inspect <item> --quantity= --grade=sellable|damaged|unsafe --disposition=restock|quarantine|repair|recycle --evidence= --actor=',
 'assess':'assess <item> --basis=consumer_guarantee|change_of_mind|other --severity=major|minor|none|unknown --customer-choice=refund|exchange|repair|store_credit|none|unknown --evidence= --actor=',
 'resolve':'resolve <item> --remedy=refund|exchange|repair|store_credit|decline --rationale= [--amount=] --actor=',
 'complete':'complete <item> --external-reference= --note= --actor=',
 'close':'close <case> --note= --actor=',
 'cancel':'cancel <case> --note= --actor=',
 'assign':'assign <case> --owner= --due=YYYY-MM-DD --retention-due=YYYY-MM-DD --actor=',
 'log':'log <case> --note= --actor=',
 'import':'import narvar <file.json> --currency=NZD --country=NZ|AU|unknown --owner= --actor= [--dry-run]',
 'export':'export <new-file.json>',
 'draft-resolution':'draft-resolution <case>',
 'weekly-review':'weekly-review',
 'help':'help',
};
const flagSets={
 add:['code','retailer','rma','order','customer','country','currency','owner','opened','due','retention-due'],
 'add-item':['code','sku','quantity','reason','requested','unit-price','exchange-sku'],
 receive:['quantity','reference','date','note'],inspect:['quantity','grade','disposition','evidence'],
 assess:['basis','severity','customer-choice','evidence'],resolve:['remedy','rationale','amount'],
 complete:['external-reference','note'],close:['note'],cancel:['note'],assign:['owner','due','retention-due'],
 log:['note'],import:['currency','country','owner','dry-run'],
};
function parse(args){
 const [command='help',...rest]=args; if(!usage[command])throw Error(`Unknown command: ${command}. Run help.`);
 const opts={},pos=[]; const allowed=new Set(['json',...(flagSets[command]||[]),...(flagSets[command]?['actor']:[])]);
 for(const arg of rest){
  if(!arg.startsWith('--')){pos.push(arg);continue;}
  const eq=arg.indexOf('=');const key=arg.slice(2,eq<0?undefined:eq);const value=eq<0?true:arg.slice(eq+1);
  if(!allowed.has(key))throw Error(`Unknown flag --${key}`);
  if(Object.hasOwn(opts,key))throw Error(`Duplicate flag --${key}`);
  if(['json','dry-run'].includes(key)&&value!==true)throw Error(`--${key} is boolean`);
  if(!['json','dry-run'].includes(key)&&value===true)throw Error(`Use --${key}=value`);
  opts[key]=value;
 }
 const expected=command==='import'?2:['case','item','add-item','receive','inspect','assess','resolve','complete','close','cancel','assign','log','export','draft-resolution'].includes(command)?1:0;
 if(pos.length!==expected)throw Error(`Usage: ${usage[command]}`);
 return {command,opts,pos};
}
const required=(o,k)=>{const v=o[k];if(typeof v!=='string'||!v.trim())throw Error(`Missing --${k}`);return v.trim();};
const text=(v,label)=>{if(!['string','number'].includes(typeof v)||!String(v).trim())throw Error(`Missing ${label}`);return String(v).trim();};
const enumeration=(v,values,label)=>{if(!values.includes(v))throw Error(`${label}: expected ${values.join('|')}`);return v;};
const integer=(v,label)=>{if(!/^\d+$/.test(String(v))||Number(v)<1||Number(v)>100000)throw Error(`${label}: expected positive integer up to 100000`);return Number(v);};
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Expected real YYYY-MM-DD date');return v;}
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function cents(v){if(!/^\d+(\.\d{1,2})?$/.test(String(v)))throw Error('Amount must be nonnegative with at most two decimals');const [a,b='']=String(v).split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>9000000000000)throw Error('Amount too large');return n;}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
async function match(db,kind,needle){
 const rows=await db.query(kind==='case'?'select * from cases order by code':'select * from item_balance order by code');
 const n=String(needle).toLowerCase();let found=rows.filter(r=>[r.id,r.code].some(v=>v.toLowerCase()===n));
 if(!found.length)found=rows.filter(r=>r.id.startsWith(n)||r.code.toLowerCase().includes(n)||String(kind==='case'?r.customer:r.sku).toLowerCase().includes(n));
 if(found.length!==1)throw Error(found.length?`Ambiguous ${kind}:\n${found.map(r=>`${r.code} | ${kind==='case'?r.customer:r.sku} | ${r.id}`).join('\n')}`:`No matching ${kind}: ${needle}`);
 return found[0];
}
function open(r){if((r.case_status||r.status)!=='open')throw Error('Case is not open');}
async function insert(db,tableName,row){const keys=Object.keys(row);const [r]=await db.query(`insert into ${tableName} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(row));return r;}
async function caseDetails(db,ref){const c=await match(db,'case',ref);return {case:c,items:await db.query('select * from item_balance where case_id=$1 order by code',[c.id]),notes:await db.query('select note,actor,created_at from notes where case_id=$1 order by created_at',[c.id])};}
async function itemDetails(db,ref){const i=await match(db,'item',ref);const out={item:i};for(const t of ['receipts','inspections','assessments','resolutions'])out[t]=await db.query(`select * from ${t} where item_id=$1 order by created_at,id`,[i.id]);return out;}

async function importNarvar(db,source,o){
 const currency=required(o,'currency');if(!/^[A-Z]{3}$/.test(currency))throw Error('Currency must be a three-letter uppercase code');
 const country=enumeration(required(o,'country'),['NZ','AU','unknown'],'country'),owner=required(o,'owner'),actor=required(o,'actor');
 const sourceText=fs.readFileSync(source,'utf8').replace(/^\uFEFF/,'');const parsed=JSON.parse(sourceText);
 const records=Array.isArray(parsed)?parsed:[parsed];if(!records.length)throw Error('Empty import');
 const batchDigest=digest({records,currency,country,owner});
 const counts={cases:0,items:0,unchanged:0,dry_run:!!o['dry-run']};
 const seen=new Set();
 for(const p of records){
  if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Expected a Narvar RMA object');
  const retailer=text(p.retailer_name,'retailer_name'),rma=text(p.rma_number,'rma_number'),order=text(p.order_number,'order_number');
  const key=JSON.stringify([retailer,rma]);if(seen.has(key))throw Error(`Duplicate RMA in file: ${retailer}/${rma}`);seen.add(key);
  const rawDate=text(p.return_creation_date,'return_creation_date');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(rawDate)||Number.isNaN(Date.parse(rawDate)))throw Error('Invalid return_creation_date timestamp');
  date(rawDate.slice(0,10)); // Reject impossible calendar days before Date can normalise them.
  const opened=new Date(rawDate).toISOString().slice(0,10);if(opened>today())throw Error('Return creation date is in the future');
  const sourceStatus=text(p.return_tracking_status,'return_tracking_status');
  const sourceMethod=text(p.return_method,'return_method');
  if(!Array.isArray(p.items)||!p.items.length)throw Error('Each RMA needs items');
  const lineSeen=new Set();
  const lines=p.items.map((x)=>{
   const sourceItem=text(x.item_id??x.line_number,'item_id or line_number');if(lineSeen.has(sourceItem))throw Error(`Duplicate item identifier ${sourceItem}`);lineSeen.add(sourceItem);
   return {source_item:sourceItem,sku:text(x.sku,'sku'),quantity:integer(x.quantity,'quantity'),
    unit_cents:x.unit_price===undefined||x.unit_price===null||x.unit_price===''?null:cents(x.unit_price),
    reason:x.reason?String(x.reason):'Unspecified in source',requested:x.transaction_type===undefined?'unknown':enumeration(x.transaction_type,['return','exchange'],'transaction_type'),
    exchange_sku:x.exchange_item?.variant_sku===undefined?'':String(x.exchange_item.variant_sku)};
  });
  const sourceDigest=digest({p,currency,country});
  const [existing]=await db.query('select source_digest from cases where retailer=$1 and rma=$2',[retailer,rma]);
  if(existing){if(existing.source_digest!==sourceDigest)throw Error(`Changed existing RMA ${retailer}/${rma}; reconcile explicitly, no overwrite`);counts.unchanged++;continue;}
  const code='NV-'+digest([retailer,rma]).slice(0,14);
  const c=await insert(db,'cases',{code,retailer,rma,order_number:order,customer:p.email?String(p.email):`Order ${order}`,country,currency,owner,
   opened_on:opened,due:addDays(opened,7),retention_due:addDays(opened,365),source_status:sourceStatus,source_method:sourceMethod,source_digest:sourceDigest,raw:JSON.stringify(p)});
  for(const line of lines){await insert(db,'items',{...line,code:code+'-'+digest(line.source_item).slice(0,8),case_id:c.id});counts.items++;}
  counts.cases++;
 }
 if(!await db.query('select id from imports where digest=$1',[batchDigest]).then(r=>r.length))await insert(db,'imports',{digest:batchDigest,source_text:sourceText,counts:JSON.stringify(counts),actor});
 return counts;
}

async function mutate(db,command,o,pos){
 const actor=required(o,'actor');
 if(command==='import'){if(pos[0]!=='narvar')throw Error('Only import narvar is supported');return importNarvar(db,pos[1],o);}
 if(command==='add'){
  const opened=date(required(o,'opened'));if(opened>today())throw Error('Opened date is in the future');
  return insert(db,'cases',{code:required(o,'code'),retailer:required(o,'retailer'),rma:required(o,'rma'),order_number:required(o,'order'),customer:required(o,'customer'),
   country:enumeration(required(o,'country'),['NZ','AU','unknown'],'country'),currency:required(o,'currency'),owner:required(o,'owner'),opened_on:opened,
   due:date(required(o,'due')),retention_due:date(required(o,'retention-due'))});
 }
 if(['add-item','close','cancel','assign','log'].includes(command)){
  const c=await match(db,'case',pos[0]);open(c);
  if(command==='add-item')return insert(db,'items',{code:required(o,'code'),case_id:c.id,source_item:required(o,'code'),sku:required(o,'sku'),quantity:integer(required(o,'quantity'),'quantity'),unit_cents:o['unit-price']===undefined?null:cents(o['unit-price']),reason:required(o,'reason'),requested:enumeration(required(o,'requested'),['return','exchange','unknown'],'requested'),exchange_sku:o['exchange-sku']||''});
  if(command==='assign')return (await db.query('update cases set owner=$1,due=$2,retention_due=$3 where id=$4 returning *',[required(o,'owner'),date(required(o,'due')),date(required(o,'retention-due')),c.id]))[0];
  if(command==='log')return insert(db,'notes',{case_id:c.id,note:required(o,'note'),actor});
  const items=await db.query('select * from item_balance where case_id=$1',[c.id]);
  if(command==='close'&&(!items.length||items.some(i=>i.received!==i.quantity||i.inspected!==i.quantity||!i.completion)))throw Error('Cannot close: receive, inspect, resolve and confirm every item first');
  if(command==='cancel'&&items.some(i=>i.received>0||i.resolution_id))throw Error('Cannot cancel after receipt or resolution');
  await insert(db,'notes',{case_id:c.id,note:required(o,'note'),actor});
  return (await db.query('update cases set status=$1 where id=$2 returning *',[command==='close'?'closed':'cancelled',c.id]))[0];
 }
 const i=await match(db,'item',pos[0]);open(i);
 if(command==='receive'){
  const quantity=integer(required(o,'quantity'),'quantity'),received=date(required(o,'date'));
  const [c]=await db.query('select opened_on from cases where id=$1',[i.case_id]);
  if(received>today()||received<c.opened_on)throw Error('Receipt date must be between case opening and today');
  if(quantity+i.received>i.quantity)throw Error('Receipt exceeds requested quantity');
  return insert(db,'receipts',{item_id:i.id,reference:required(o,'reference'),quantity,received_on:received,actor,note:required(o,'note')});
 }
 if(command==='inspect'){
  if(i.resolution_id)throw Error('Resolution already recorded');
  const quantity=integer(required(o,'quantity'),'quantity');if(quantity+i.inspected>i.received)throw Error('Inspection exceeds received quantity');
  return insert(db,'inspections',{item_id:i.id,quantity,grade:required(o,'grade'),disposition:required(o,'disposition'),evidence:required(o,'evidence'),actor});
 }
 if(command==='assess'){
  if(i.resolution_id)throw Error('Assessment is fixed once a resolution is recorded');
  return insert(db,'assessments',{item_id:i.id,basis:required(o,'basis'),severity:required(o,'severity'),customer_choice:required(o,'customer-choice'),evidence:required(o,'evidence'),actor});
 }
 if(command==='resolve'){
  if(i.received!==i.quantity||i.inspected!==i.quantity)throw Error('Receive and inspect every unit first');
  if(!i.assessment_id)throw Error('Human assessment required');
  if(i.country==='unknown')throw Error('Confirm jurisdiction before resolving; use a reviewed migration to correct case country');
  const [a]=await db.query('select * from assessments where id=$1',[i.assessment_id]);
  const remedy=required(o,'remedy');
  if(a.basis==='consumer_guarantee'&&a.severity==='unknown')throw Error('Review severity before resolving');
  if(a.basis==='consumer_guarantee'&&a.severity==='major'&&(!['refund','exchange'].includes(a.customer_choice)||remedy!==a.customer_choice))throw Error('Major defect: record refund or replacement choice and matching remedy; other outcomes need a reviewed policy change');
  if(['refund','store_credit'].includes(remedy)&&o.amount===undefined)throw Error('Record agreed --amount for monetary remedy');
  return insert(db,'resolutions',{item_id:i.id,assessment_id:i.assessment_id,remedy,amount_cents:o.amount===undefined?null:cents(o.amount),rationale:required(o,'rationale'),actor});
 }
 if(command==='complete'){
  if(!i.resolution_id)throw Error('Resolution required before completion');
  return insert(db,'completions',{resolution_id:i.resolution_id,external_reference:required(o,'external-reference'),note:required(o,'note'),actor});
 }
 throw Error('Unsupported mutation');
}

export async function run(db,args){
 const {command,opts:o,pos}=parse(args);
 if(command==='help')return Object.entries(usage).map(([command,usage])=>({command,usage}));
 if(reads[command])return db.query(reads[command]);
 if(command==='case')return caseDetails(db,pos[0]);
 if(command==='item')return itemDetails(db,pos[0]);
 if(command==='weekly-review')return {attention:await db.query(reads.attention),inspection_queue:await db.query(reads['inspection-queue']),compliance:await db.query(reads.compliance)};
 if(command==='export'){
  const snapshot={format:'returns-desk-v1',exported_at:new Date().toISOString(),tables:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{for(const t of ['cases','items','receipts','inspections','assessments','resolutions','completions','notes','imports','activity'])snapshot.tables[t]=await db.query(`select * from ${t} order by id`);}
  finally{await db.exec('ROLLBACK');}
  const file=path.resolve(pos[0]);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600});return {file,records:Object.values(snapshot.tables).reduce((n,r)=>n+r.length,0)};
 }
 if(command==='draft-resolution'){
  const data=await caseDetails(db,pos[0]);const c=data.case;
  const decision=await db.query('select * from decision_queue where case_code=$1 order by code',[c.code]);
  const content=`DRAFT FOR INTERNAL REVIEW. Not sent.\nCase: ${c.code}\nOrder: ${c.order_number}\nCustomer: ${c.customer}\n\n${format(decision)}\n\nConfirm consumer rights, amounts, external completion and recipient before writing to the customer.\n`;
  const dir=path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const file=path.join(dir,`resolution-${c.id}-${randomUUID()}.txt`);fs.writeFileSync(file,content,{flag:'wx',mode:0o600});return {file};
 }
 await db.exec('BEGIN');
 try{
  // Serialise writers, including multi-line imports, on both database adapters.
  await db.exec('LOCK TABLE cases IN SHARE ROW EXCLUSIVE MODE');
  const result=await mutate(db,command,o,pos);
  await insert(db,'activity',{command,actor:required(o,'actor'),detail:JSON.stringify({reference:pos,result})});
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function format(value){
 if(Array.isArray(value)){
  if(!value.length)return '  (none)';
  const cols=Object.keys(value[0]);
  return table(value.map(r=>Object.fromEntries(cols.map(k=>[k,r[k]===null?'unknown':typeof r[k]==='object'?JSON.stringify(r[k]):r[k]]))),cols.map(key=>({key,label:key.replaceAll('_',' '),width:key==='evidence'||key==='finding'?68:36})));
 }
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>Array.isArray(v)?`${k}\n${format(v)}`:v&&typeof v==='object'?`${k}\n${format([v])}`:`${k}: ${v}`).join('\n\n');
 return String(value);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):format(result));}
 catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
