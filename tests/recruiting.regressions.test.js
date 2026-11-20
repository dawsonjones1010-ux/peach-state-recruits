const { test } = require('node:test'); const a = require('node:assert/strict'); const L = require('../recruiting/logic.js');
test('dates reject impossible calendar days and invalid input',()=>{
 a.equal(L.parseISO('2026-02-30'),null);a.equal(L.parseISO('2026-13-01'),null);a.equal(L.parseISO('not a date'),null);
 a.equal(L.toISO('2028-02-29'),'2028-02-29');a.throws(()=>L.toISO('2026-02-29'));
});
test('same-day outbound clears reply waiting, new inbound reopens it',()=>{
 const rows=[{id:'a',program_id:'x',direction:'received',occurred_on:'2026-11-20',created_at:'2026-11-20T10:00:00Z'},{id:'b',program_id:'x',direction:'sent',occurred_on:'2026-11-20',created_at:'2026-11-20T11:00:00Z'}];
 a.equal(L.schoolStatus('x',rows).awaitingReply,false);
 rows.push({id:'c',program_id:'x',direction:'received',occurred_on:'2026-11-20',created_at:'2026-11-20T12:00:00Z'});
 a.equal(L.schoolStatus('x',rows).awaitingReply,true);
});
test('follow-up reminders are superseded by later communication',()=>{
 const old={id:'a',program_id:'x',occurred_on:'2026-11-01',follow_up_on:'2026-11-10'};
 a.equal(L.dueFollowUps([old], '2026-11-20').length,1);
 a.equal(L.dueFollowUps([old,{id:'b',program_id:'x',occurred_on:'2026-11-15',direction:'received'}], '2026-11-20').length,0);
});
test('hidden schools and unknown fees do not pass zero-cost filters',()=>{
 a.deepEqual(L.filterPrograms([{name:'X',record_status:'hidden'}],{}),[]);
 a.equal(L.filterPrograms([{name:'X',avg_net_price:10}],{maxNetPrice:0}).length,0);
 const camps=[{id:'free',start_date:'2026-12-01',price_cents:0},{id:'unknown',start_date:'2026-12-01'},{id:'invalid',start_date:'2026-02-30',price_cents:0}];
 a.deepEqual(L.filterCamps(camps,{maxPrice:0},'2026-11-20').map(c=>c.id),['free']);
});
test('camp range includes ongoing events and excludes broken dates',()=>{
 a.equal(L.filterCamps([{start_date:'2026-11-19',end_date:'2026-11-22'}],{from:'2026-11-20'},'2026-11-20').length,1);
 a.equal(L.isStale({last_checked:'invalid'},'2026-11-20'),true);
});
test('Unicode ICS folds by bytes and URL cannot inject calendar lines',()=>{
 const text=L.buildICS([{id:'x\r\nBAD',title:'⚾'.repeat(60),start_date:'2026-12-01',registration_url:'https://a.edu\r\nBEGIN:BAD'}]);
 text.split('\r\n').forEach(line=>a.ok(Buffer.byteLength(line)<=75));
 a.ok(!text.includes('\r\nBEGIN:BAD'));a.throws(()=>L.buildICS([{start_date:'2026-02-30'}]));
});
test('travel flags unknown fees and impossible gas assumptions',()=>{
 const e=L.travelEstimate({miles_one_way:100,mpg:0},{});a.equal(e.complete,false);a.equal(e.registrationUnknown,true);a.equal(e.errors.length,1);
});
test('CSV importer rejects malformed data and invalid numeric ranges',()=>{
 a.throws(()=>L.parseCSV('name,name\nA,B'));a.throws(()=>L.parseCSV('name,level\n"A,NCAA D1'));
 a.equal(L.parseCSV('\uFEFFname,level\nA,NAIA')[0].name,'A');
 for(const row of [{name:'A'},{name:'A',level:'NAIA',avg_net_price:'Infinity'},{name:'A',level:'NAIA',admission_rate:200},{name:'A',level:'NAIA',last_checked:'2026-02-30'},{name:'A',level:'NAIA',record_status:'verified'}]) a.ok(L.normalizeProgramRow(row).errors.length);
 a.equal(L.normalizeProgramRow({name:'A',level:'NAIA',admission_rate:'0.5%'}).row.admission_rate,0.005);
 a.ok(L.normalizeProgramRow({name:'A',level:'NAIA',sat_25:1400,sat_75:1200,academic_year:'2024-25',academic_source_url:'https://example.edu'}).errors.some(x=>x.includes('cannot exceed')));
});
test('new introductions reopen when an additional school is saved',()=>{
 const profile={first_name:'A',last_name:'B',grad_year:2027,primary_position:'SS',high_school:'HS',contact_email:'a@b.com'};
 const task=L.planCandidates({profile,saved:[{program_id:'new'}]}).find(t=>t.rule_key==='first_intros');
 a.ok(task.dynamic);a.equal(task.subkey,'new');
 const view=L.planView([task],[{rule_key:'first_intros',status:'done',rule_subkey:'old'}],'2026-11-20');a.equal(view.open.length,1);
});
