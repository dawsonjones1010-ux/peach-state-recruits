/* Evidence-informed, deterministic email drafts. No network, invented school facts or reply scores. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PSREmail=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const clean=v=>String(v??'').trim(),num=v=>typeof v==='number'&&Number.isFinite(v),url=v=>{try{const u=new URL(v);return ['http:','https:'].includes(u.protocol)&&!/[\r\n]/.test(v)?u.href:'';}catch{return '';}};
 const KINDS={introduction:'First introduction',update:'Meaningful update',event_invite:'Upcoming event / camp',follow_up:'Thoughtful follow-up'};
 function fullName(p){return [p.first_name,p.last_name].map(clean).filter(Boolean).join(' ');}
 function metricLines(p,measurement){const m=p.metrics||{},pos=clean(p.primary_position).toUpperCase();let defs;
  if(pos==='P'||/^(RHP|LHP)$/.test(pos))defs=[['game_fb','Game FB','mph'],['fb_velo','Peak FB','mph']];
  else if(pos==='C')defs=[['exit_velo','Max EV','mph'],['pop','Best pop to 2B','s'],['c_velo','C arm','mph']];
  else defs=[['exit_velo','Max EV','mph'],['sixty','60-yard','s'],[['LF','CF','RF','OF'].includes(pos)?'of_velo':'if_velo','Position arm','mph']];
  const lines=defs.filter(([k])=>num(m[k])).map(([k,label,u])=>label+' '+(u==='s'?m[k].toFixed(2):m[k])+' '+u);
  if(lines.length&&measurement&&measurement.date)lines.push('measured '+measurement.date);
  return lines;
 }
 function positionLabel(p){return p.primary_position==='P'&&['R','L'].includes(p.throws)?p.throws+'HP':p.primary_position||'[Position]';}
 function greeting(name){const n=clean(name).replace(/^coach\s+/i,'');return n?'Coach '+n.split(/\s+/).slice(-1)[0]+',':'Coach,';}
 function subjectOptions(kind,ctx){const p=ctx.profile||{},name=fullName(p)||'[Your name]',year=p.grad_year||'[Grad year]',position=positionLabel(p),stat=metricLines(p)[0];const base=[year,position,name].join(' | ');
  const tag=kind==='update'?'Update':kind==='follow_up'?'Following up':kind==='event_invite'?(ctx.event?.title||'Upcoming event'):'';
  return [...new Set([base+(p.video_url?' | Video':''),base+(stat?' | '+stat:''),(tag?tag+' | ':'')+base])];
 }
 function build(kind,ctx){if(!KINDS[kind])throw new Error('Choose a supported email type');ctx=ctx||{};const p=ctx.profile||{},program=ctx.program||{},name=fullName(p)||'[Your name]',school=program.name||'[School name]',pos=positionLabel(p),year=p.grad_year||'[Grad year]';
  const intro=`I'm ${name}, a ${year} ${pos}${p.secondary_position?' / '+p.secondary_position:''}${p.high_school?' at '+p.high_school:''}${p.hs_city?' in '+[p.hs_city,p.hs_state].filter(Boolean).join(', '):''}.`;
  const notes=ctx.details||{},metrics=metricLines(p,ctx.measurement);const academics=[num(p.gpa)?p.gpa+' GPA'+(notes.gpaScale?' ('+clean(notes.gpaScale)+')':''):'',num(p.sat)?p.sat+' SAT':'',num(p.act)?p.act+' ACT':'',p.intended_major?'Interested in '+p.intended_major:''].filter(Boolean).join(' | ');
  const size=[num(p.height_in)?Math.floor(p.height_in/12)+"'"+(p.height_in%12)+' in':'',num(p.weight_lb)?p.weight_lb+' lb':'',p.bats?'Bats '+p.bats:'',p.throws?'Throws '+p.throws:''].filter(Boolean).join(' | ');
  const video=url(p.video_url)?'Video: '+url(p.video_url):'[Add a public skills video link]';const reason=clean(notes.reason||ctx.personalNote);const update=clean(notes.update||ctx.updateNote||ctx.followNote);
  let middle=[];
  if(kind==='introduction')middle=[intro,reason?`I'm interested in ${school} because ${reason.replace(/^because\s+/i,'').replace(/[.!?]$/,'')}.`:`[Add a specific reason you are interested in ${school}]`,video,metrics.length?'Measurements: '+metrics.join(' | '):'',size,academics,notes.questionnaire?'I completed your recruiting questionnaire.':'',clean(notes.schedule)?'Upcoming schedule: '+clean(notes.schedule):'','Would you review my video and let me know what you would need to evaluate me for your program?'];
  if(kind==='update')middle=[intro,`I wanted to share an update as I continue learning about ${school}.`,update||'[Add one meaningful update: a new measurement, video, academic result or schedule]',video,metrics.length?'Measurements: '+metrics.join(' | '):'',size,academics,reason?'My interest in your school: '+reason.replace(/[.!?]$/,'')+'.':'',clean(notes.schedule)?'Upcoming schedule: '+clean(notes.schedule):'','What would you like to see from me next in your recruiting process?'];
  if(kind==='follow_up')middle=[intro,`I'm following up on my ${ctx.lastSentOn?ctx.lastSentOn+' ':''}email about ${school}.`,update||'[Add something new since your last message]',video,reason?'I remain interested because '+reason.replace(/^because\s+/i,'').replace(/[.!?]$/,'')+'.':'','Would you let me know whether you need anything else to evaluate me?'];
  if(kind==='event_invite'){const e=ctx.event||{};const details=[e.title,e.start_date,[e.venue,e.city,e.state].filter(Boolean).join(', ')].filter(Boolean).join(' | ');middle=[intro,notes.eventMode==='camp'?`I plan to attend ${details||'[Camp name, date and location]'} and wanted to introduce myself before the camp.`:`My upcoming event: ${details||'[Event name, date and location]'}.`,clean(notes.schedule)?'Team, jersey and game details: '+clean(notes.schedule):'[Add your team, jersey and game times, or camp attendance details]',video,metrics.length?'Measurements: '+metrics.join(' | '):'',notes.eventMode==='camp'?'Is there anything your staff would like me to bring or prepare?':'If your staff will be there, I would appreciate the opportunity to be evaluated.'];}
  const refs=[clean(notes.hsCoach)?'HS coach: '+clean(notes.hsCoach):'',clean(notes.clubCoach)?'Club coach: '+clean(notes.clubCoach):''].filter(Boolean);
  const signature=[name,year+' | '+pos,[p.phone,p.contact_email].map(clean).filter(Boolean).join(' | '),url(p.profile_url)?'Profile: '+url(p.profile_url):'',...refs].filter(Boolean).join('\n');
  return {subject:subjectOptions(kind,ctx)[0],body:[greeting(ctx.coachName),'',...middle.filter(Boolean).flatMap(x=>[x,'']),'Thank you,',signature].join('\n').replace(/\n{3,}/g,'\n\n')};
 }
 function inspect(draft,ctx){const p=ctx.profile||{},notes=ctx.details||{},text=clean(draft.body),subject=clean(draft.subject),checks=[],warn=[];const check=(id,label,ok,blocking=false)=>checks.push({id,label,ok:!!ok,blocking});
  check('name','Your full name',clean(p.first_name)&&clean(p.last_name)&&text.includes(fullName(p)),true);
  check('year','Graduation year',p.grad_year&&text.includes(String(p.grad_year)),true);
  check('position','Position',p.primary_position&&text.toLowerCase().includes(clean(p.primary_position).toLowerCase()),true);
  check('school','One selected school',!!ctx.program?.name,true);
  if(ctx.generatedForSchool && ctx.generatedForSchool!==ctx.program?.name) check('school_consistency','Message reviewed for the selected school',false,true);
  check('recipient','Coach email from official staff page',/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(clean(draft.to)),true);
  check('subject','Subject is present and on one line',!!subject&&!/[\r\n]/.test(subject),true);
  check('no_placeholders','No unfinished placeholders',!(/\[[^\]]*\]|\{\{[^}]*\}\}|INSERT\s+(?:YOUR|HERE)/i.test(text+' '+subject)),true);
  check('video','Public video link included',!!url(p.video_url)&&text.includes(url(p.video_url)));
  check('personal','School-specific reason',ctx.kind==='event_invite'||(clean(notes.reason).length>=12&&text.toLowerCase().includes(clean(notes.reason).toLowerCase().replace(/[.!?]$/,''))));
  check('contact','Player contact information',!!(p.contact_email||p.phone)&&[p.contact_email,p.phone].filter(Boolean).some(x=>text.includes(x)));
  check('question','A clear next step',text.includes('?')||ctx.kind==='event_invite');
  if(ctx.kind==='update'||ctx.kind==='follow_up')check('update','Something new to share',clean(notes.update).length>=10);
  const ranges={fb_velo:[35,110],game_fb:[35,110],exit_velo:[30,130],sixty:[5.5,11],if_velo:[35,110],of_velo:[35,110],c_velo:[35,110],pop:[1.5,3.5]};
  const invalid=Object.entries(p.metrics||{}).filter(([k,v])=>ranges[k]&&(!num(v)||v<ranges[k][0]||v>ranges[k][1]));
  check('metric_validity','Measurement entries pass typo checks',!invalid.length,true);
  if(num(p.metrics?.game_fb)&&num(p.metrics?.fb_velo))check('pitch_consistency','Game fastball does not exceed peak',p.metrics.game_fb<=p.metrics.fb_velo,true);
  check('class_validity','Valid graduation year',Number.isInteger(p.grad_year)&&p.grad_year>=2024&&p.grad_year<=2045,true);
  if(p.video_url)check('video_url_validity','Video URL is valid',!!url(p.video_url),true);
  const date=ctx.measurement?.date;
  if(date){const d=new Date(date+'T12:00:00');const actual=Number.isFinite(+d)?[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'):'';check('date_validity','Real measurement date',actual===date,true);}
  const words=text?text.split(/\s+/).length:0;
  if(subject.length>75)warn.push('Subject exceeds 75 characters; it may be truncated on a phone.');
  if(words>220)warn.push('This draft is over 220 words. Consider trimming details already on your profile. This is an editing suggestion, not a proven reply-rate threshold.');
  if(/\b(?:attached|attachment)\b/i.test(text))warn.push('You mention an attachment. This tool attaches no files; add it yourself or use a link.');
  if(/\b(?:guaranteed|d1[- ]caliber|power[- ]5[- ]caliber|verified)\b/i.test(text))warn.push('Review ability or verification claims. This tool has not independently verified your metrics.');
  if(!ctx.measurement?.date&&metricLines(p).length)warn.push('Your measurements have no date. Add measurement context or avoid implying they are current.');
  const others=(ctx.otherPrograms||[]).filter(x=>x.name&&x.name!==ctx.program?.name&&x.name.length>6&&text.toLowerCase().includes(x.name.toLowerCase()));
  if(others.length)check('wrong_school','No other school name in the message',false,true);
  const links=[...text.matchAll(/https?:\/\/[^\s<>]+/g)].map(x=>x[0]);if(links.some(x=>!url(x)))warn.push('A link appears malformed. Open every link before sending.');
  if(notes.researchUrl&&!url(notes.researchUrl))warn.push('Your school research URL is invalid. Use an official school page.');
  if(notes.videoChecked!==true)warn.push('Open the video in a signed-out browser yourself to check access; the tool cannot verify a video is public.');
  return {checks,warnings:warn,words,subjectCharacters:subject.length,blocking:checks.filter(c=>!c.ok&&c.blocking),ready:checks.every(c=>c.ok||!c.blocking),passed:checks.filter(c=>c.ok).length};
 }
 function communication(level,grad,today){const date=new Date(today||Date.now());const year=Number(grad);const target=Number.isInteger(year)&&year>=2000&&year<=2100?`${year-2}-08-01`:null;const now=typeof today==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(today)?today:[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  if(/D1/.test(level||'')){
   const calendar=typeof module==='object'&&module.exports?require('./calendar'):typeof window!=='undefined'?window.PSRCalendar:null;
   const period=calendar?calendar.status(now):{type:'unknown',known:false,text:'Check the current official calendar before contacting staff.'};
   const base=!target?'Add your grad year for general U.S. high-school timing.':now<target?`D1 baseball recruiting calls and electronic communication generally begin August 1 before junior year (${target}). Do not interpret silence before then as rejection.`:'Your class is past the general D1 baseball communication start date. Visits and off-campus contact have separate restrictions.';
   const text=period.type==='shutdown'?`${period.label} (${period.start}–${period.end}). ${period.text} ${base}`:base+' '+(period.known?`${period.label}: ${period.text}`:period.text);
   return {restricted:(!!target&&now<target)||period.type==='shutdown',date:target,text,source:'NCAA_DI',calendar:period};
  }
  return {restricted:false,date:null,text:/D2/.test(level||'')?'D2 recruiting communication is generally permitted at any time. Off-campus contact and official visits have separate dates.':'Check the school’s current recruiting and eligibility rules. Transfers and signed athletics aid can change whether staff may communicate with you.',source:/D2/.test(level||'')?'NCAA_DII':'NCAA_RECRUIT'};
 }
 function mailto(draft){return 'mailto:'+encodeURIComponent(clean(draft.to)).replace(/%40/g,'@')+'?subject='+encodeURIComponent(clean(draft.subject).replace(/[\r\n]+/g,' '))+'&body='+encodeURIComponent(draft.body||'');}
 function eml(draft){
  const b64=s=>typeof Buffer!=='undefined'?Buffer.from(s).toString('base64'):btoa(unescape(encodeURIComponent(s)));
  const subject=clean(draft.subject).replace(/[\r\n]+/g,' '),chunks=[];let chunk='';
  for(const ch of subject){if(new TextEncoder().encode(chunk+ch).length>42){chunks.push(chunk);chunk='';}chunk+=ch;}if(chunk)chunks.push(chunk);
  const header=chunks.map(s=>'=?UTF-8?B?'+b64(s)+'?=').join('\r\n ');
  return ['X-Unsent: 1','To: '+clean(draft.to).replace(/[\r\n]/g,''),'Subject: '+header,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',(b64(draft.body||'').match(/.{1,76}/g)||[]).join('\r\n')].join('\r\n')+'\r\n';
 }

 return {KINDS,build,inspect,metricLines,subjectOptions,communication,mailto,eml,url,fullName};
});
