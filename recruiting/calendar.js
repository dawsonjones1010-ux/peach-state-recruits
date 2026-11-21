/* NCAA DI baseball only. Reviewed against the NCAA's July 30, 2026 calendar.
   Calendar periods and class-year restrictions are independent requirements. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PSRCalendar=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const source='https://ncaaorg.s3.amazonaws.com/compliance/recruiting/calendar/2026-27/2026-27D1Rec_MBARecruitingCalendar.pdf';
  const shutdownSource='https://ncaaorg.s3.amazonaws.com/compliance/recruiting/d1/D1Rec_Shutdown.pdf';
  const periods=[
    ['2026-08-01','2026-08-16','contact'],['2026-08-17','2026-09-10','quiet'],
    ['2026-09-11','2026-10-11','contact'],['2026-10-12','2027-02-28','quiet'],
    ['2027-03-01','2027-07-31','contact']
  ];
  const overrides=[
    ['2026-11-09','2026-11-12','dead'],['2026-11-24','2026-11-29','shutdown'],
    ['2026-12-22','2026-12-27','shutdown'],['2027-01-07','2027-01-10','dead'],
    ['2027-05-31','2027-06-07','dead'],['2027-06-19','2027-06-21','dead'],
    ['2027-07-03','2027-07-05','dead']
  ];
  const meaning={
    contact:'The calendar permits off-campus recruiting contacts and evaluations, subject to class-year limits and other rules.',
    quiet:'In-person recruiting contacts are limited to campus. Off-campus contacts and evaluations are restricted; class-year rules still apply.',
    dead:'In-person recruiting contacts, evaluations and recruiting visits are restricted. This is different from a shutdown; permitted electronic communication still depends on other rules.',
    shutdown:'Recruiting correspondence, calls, evaluations and visits are restricted. Prepare your draft and confirm the next permissible contact with school compliance. The NCAA lists exceptions, including contact with signed prospects.'
  };
  function iso(value){
    if(value===undefined){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const d=new Date(value+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===value?value:null;
  }
  function status(value){
    const date=iso(value),base={date,season:'2026–27',source,shutdownSource,checked:'2026-11-20',known:false,type:'unknown',label:'Calendar needs checking',text:'No reviewed DI baseball calendar is loaded for this date. Open the current NCAA calendar; do not infer that contact or a visit is permitted.'};
    if(!date||date<'2026-08-01'||date>'2027-07-31')return base;
    const row=overrides.find(r=>date>=r[0]&&date<=r[1])||periods.find(r=>date>=r[0]&&date<=r[1]);
    const labels={contact:'Contact period',quiet:'Quiet period',dead:'Dead period',shutdown:'Recruiting shutdown'};
    return {...base,known:true,type:row[2],label:labels[row[2]],text:meaning[row[2]],start:row[0],end:row[1]};
  }
  return {status,source,shutdownSource,iso};
});
