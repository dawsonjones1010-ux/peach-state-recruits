const {test}=require('node:test'),a=require('node:assert/strict');const E=require('../recruiting/email'),R=require('../estimator/report'),L=require('../estimator/logic');const data=require('../data/level-benchmarks-v1.0.json');
const input={gradYear:2027,primary:'CF',secondary:'',throws:'R',bats:'R',heightIn:72,weightLb:180,metrics:{maxEv:94,sixty:6.75,ofVelo:88},methods:{sixty:'hand',ev:'tee'},meta:{date:'2026-10-01',source:'event'}};
const profile={first_name:'Alex',last_name:'Rivera',grad_year:2027,primary_position:'CF',high_school:'Test High',contact_email:'alex@example.com',video_url:'https://video.example/skills',metrics:{exit_velo:94,sixty:6.75,of_velo:88}};
const ctx={profile,program:{name:'Example University',level:'NCAA D1'},coachName:'John Smith',kind:'introduction',details:{reason:'your published economics degree fits what I want to study',update:'I recorded a new 94 mph exit velocity on November 1.',videoChecked:true},measurement:{date:'2026-11-01'}};
test('drafts are factual, position-specific and school-specific for all four purposes',()=>{
 for(const kind of Object.keys(E.KINDS)){const c={...ctx,kind,event:{title:'Winter showcase',start_date:'2026-12-10',city:'Atlanta'},details:{...ctx.details,schedule:'Team Example | #14 | Field 2 at 10 AM'}};const d=E.build(kind,c);a.ok(d.body.includes('Alex Rivera'));a.ok(!/undefined|null|guaranteed|D1 caliber|verified athlete/i.test(d.body));a.ok(d.subject.includes('2027'));a.ok(d.subject.includes('CF'));a.ok(d.body.includes('https://video.example/skills'));}
 const d=E.build('introduction',ctx);a.ok(d.body.includes(ctx.details.reason));a.ok(d.body.includes('94 mph'));a.ok(!d.body.includes('Peak FB'));
});
test('missing school research is left unfinished rather than invented',()=>{
 const d=E.build('introduction',{...ctx,details:{}});a.match(d.body,/\[Add a specific reason/);a.ok(!E.inspect({...d,to:'coach@example.edu'}, {...ctx,details:{}}).ready);
});
test('pitcher game and peak velocity remain distinct; catcher gets catcher metrics',()=>{
 let p={...profile,primary_position:'P',metrics:{fb_velo:88,game_fb:85,exit_velo:100}};a.deepEqual(E.metricLines(p),['Game FB 85 mph','Peak FB 88 mph']);
 p={...profile,primary_position:'C',metrics:{pop:1.99,c_velo:80,exit_velo:92}};a.ok(E.metricLines(p).join(' ').includes('Best pop to 2B 1.99 s'));a.ok(!E.metricLines(p).join(' ').includes('OF'));
});
test('readiness checks never output an offer or reply probability',()=>{
 const d=E.build('introduction',ctx),r=E.inspect({...d,to:'coach@example.edu'},ctx);a.equal(r.ready,true);a.ok(!('score' in r));a.ok(r.words>30);a.ok(!r.blocking.length);
});
test('recipient/header injection, wrong school, impossible numbers and placeholders block readiness',()=>{
 const d=E.build('introduction',ctx);
 for(const bad of [{...d,to:'a@b.edu\r\nBcc:x@y.edu'},{...d,to:'a@b.edu',subject:'Hello\r\nBcc:x@y.edu'},{...d,to:'a@b.edu',body:d.body+' [INSERT HERE]'}])a.equal(E.inspect(bad,ctx).ready,false);
 a.equal(E.inspect({...d,to:'coach@example.edu'},{...ctx,generatedForSchool:'Other University'}).ready,false);
 a.equal(E.inspect({...d,to:'coach@example.edu'},{...ctx,profile:{...profile,metrics:{exit_velo:999}}}).ready,false);
});
test('D1 and D2 communication dates are separate from visit/contact dates',()=>{
 a.equal(E.communication('NCAA D1',2029,'2026-11-20').restricted,true);a.equal(E.communication('NCAA D1',2028,'2026-11-20').restricted,false);
 a.match(E.communication('NCAA D2',2030,'2026-11-20').text,/any time/);a.match(E.communication('NCAA D2',2030).text,/separate/);
});
test('email exports preserve Unicode and cannot inject Subject headers',()=>{
 const d={to:'coach@example.edu',subject:'José ⚾ '.repeat(25)+'\r\nBcc:bad@example.com',body:'Hello Coach,\nJosé here.'};const eml=E.eml(d);a.ok(!eml.includes('\r\nBcc:'));a.match(eml,/X-Unsent: 1/);eml.split('\r\n').forEach(l=>a.ok(Buffer.byteLength(l)<=78));a.ok(E.mailto(d).includes('%0A'));
});
test('measurement context flags limitations without changing results',()=>{
 const read=L.evaluate(data,input).reads[0],before=JSON.stringify(read);const ev=R.evidence(input,read,'2026-11-20');a.equal(ev.verified,false);a.ok(ev.issues.some(x=>/hand-timed/i.test(x)));a.equal(JSON.stringify(read),before);
});
test('NCSA cross-check preserves pooled levels and strict speed targets',()=>{
 const read=L.evaluate(data,input).reads[0];let rows=R.crossCheck(data,{...input,metrics:{...input.metrics,sixty:6.7}},read);a.equal(rows[0].level,'D1 (all)');a.equal(rows[0].tools.find(t=>t.label==='60-yard dash').met,false);a.equal(rows[2].level,'D3 / NAIA');
 const p={...input,primary:'P',metrics:{maxFb:90}};rows=R.crossCheck(data,p,L.evaluate(data,p).reads[0]);a.equal(rows[0].tools[0].met,null);a.equal(rows[0].tools[0].value,undefined);
});
test('what-if simulation never overwrites actual input or invents growth',()=>{
 const read=L.evaluate(data,input).reads[0],before=JSON.stringify(input);const x=R.scenario(data,input,read,{sixty:6.6});a.equal(x.hypothetical,true);a.equal(input.metrics.sixty,6.75);a.equal(JSON.stringify(input),before);a.throws(()=>R.scenario(data,input,read,{sixty:1}));
});
test('email handoff contains actual measurements, never assigned divisions',()=>{
 const read=L.evaluate(data,input).reads[0],handoff=R.handoff(input,read);a.equal(handoff.profile.metrics.exit_velo,94);a.ok(!('level' in handoff));a.ok(!('headline' in handoff));a.equal(handoff.profile.primary_position,'CF');
});
test('validation rejects invalid dates, positions, sides and fractional graduation years',()=>{
 const broken={...input,primary:'QB',bats:'?',throws:'?',gradYear:2027.5,meta:{date:'2026-02-30'}};const r=L.validate(broken);for(const key of ['primary','bats','throws','gradYear','date'])a.ok(r.errors.some(e=>e.field===key));
});
