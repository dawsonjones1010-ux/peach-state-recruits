const {test}=require('node:test'),a=require('node:assert/strict');
const R=require('../recruiting/roadmap'),C=require('../recruiting/calendar'),E=require('../recruiting/email');
test('calendar boundaries preserve quiet, dead and shutdown differences',()=>{
  for(const [date,type] of [['2026-08-01','contact'],['2026-08-16','contact'],['2026-08-17','quiet'],['2026-09-10','quiet'],['2026-09-11','contact'],['2026-11-09','dead'],['2026-11-12','dead'],['2026-11-13','quiet'],['2026-11-23','quiet'],['2026-11-24','shutdown'],['2026-11-29','shutdown'],['2026-11-30','quiet'],['2026-12-22','shutdown'],['2026-12-27','shutdown'],['2026-12-28','quiet'],['2027-01-07','dead'],['2027-02-28','quiet'],['2027-03-01','contact'],['2027-05-31','dead'],['2027-06-07','dead'],['2027-06-08','contact'],['2027-06-19','dead'],['2027-06-21','dead'],['2027-07-03','dead'],['2027-07-05','dead'],['2027-07-31','contact']]) a.equal(C.status(date).type,type,date);
});
test('expired, unsupported and impossible dates never imply permission',()=>{
 for(const date of ['2026-07-31','2027-08-01','2030-11-24','2026-02-30','garbage',null]){a.equal(C.status(date).known,false);a.equal(C.status(date).type,'unknown');}
});
test('DI email guidance combines class year with shutdown and discloses exceptions',()=>{
 a.equal(E.communication('NCAA D1',2027,'2026-11-24').restricted,true);
 a.match(E.communication('NCAA D1',2027,'2026-11-24').text,/signed prospects/);
 a.equal(E.communication('NCAA D1',2027,'2026-11-30').restricted,false);
 a.equal(E.communication('NCAA D1',2030,'2026-11-30').restricted,true);
 a.equal(E.communication('NCAA D1',2027,'2026-11-10').calendar.type,'dead');
 a.equal(E.communication('NCAA D2',2027,'2026-11-24').restricted,false);
 a.equal(E.communication('NCAA D1',2028,'2027-09-01').calendar.known,false);
});
test('annual net price excludes loans/work-study and unknown values never become zero',()=>{
 const row={tuition:20000,housing:12000,other:3000,gifts:15000,loans:10000,work:3000,budget:18000};
 const v=R.annualCost(row);a.equal(v.net,20000);a.equal(v.total,35000);a.equal(v.gap,2000);a.equal(v.loans,10000);
 for(const val of ['',null,undefined,-2,Infinity,'bad',true,{}])a.equal(R.annualCost({...row,gifts:val}).complete,false);
 a.equal(R.annualCost({...row,gifts:0}).net,35000);a.equal(R.annualCost({...row,gifts:50000}).excessAid,true);
 a.equal(R.annualCost({tuition:0,housing:0,other:0,gifts:0}).complete,true);
});
test('camp decision withholds a complete result when costs or evidence are missing',()=>{
 const yes=Object.fromEntries(R.CAMP_QUESTIONS.map(([id])=>[id,'yes'])),costs={registration:200,travel:100,hotel:0,other:50,budget:400};
 a.equal(R.campDecision(yes,costs).label,'Ready for a family decision');
 a.equal(R.campDecision({...yes,eligible:'no'},costs).label,'Hold before booking');
 a.equal(R.campDecision(yes,{...costs,budget:300}).label,'Hold before booking');
 a.equal(R.campDecision(yes,{...costs,hotel:''}).total,null);
 a.equal(R.campDecision(yes,{...costs,budget:''}).label,'Check the missing details');
 a.equal(R.campDecision({...yes,staff:'unknown'},costs).label,'Check the missing details');
});
test('plans are stage-specific and completing a step preserves others',()=>{
 a.equal(R.plan('freshman')[0].id,'academics');a.equal(R.plan('senior')[0].id,'apply');
 const p=R.plan('junior',{video:true});a.equal(p.find(t=>t.id==='video').done,true);a.equal(p.find(t=>t.id==='outreach').done,false);
 a.ok(R.film('P').some(t=>t.id==='pitches'));a.ok(R.film('C').some(t=>t.id==='receiving'));a.ok(!R.film('P').some(t=>t.id==='receiving'));
});
test('coverage counts visible sourced records, retaining valid zero net prices',()=>{
 const c=R.coverage([{record_status:'hidden',avg_net_price:20},{record_status:'unverified'},{record_status:'verified',last_checked:'2026-11-01',staff_url:'https://example.edu/baseball',academic_source_url:'https://collegescorecard.ed.gov',academic_year:'2024–25',avg_net_price:0}]);
 a.deepEqual(c,{total:2,checked:1,academics:1,cost:1,staff:1});
});
