/* Decision support around the existing sourced comparisons. No athletic score or growth projection. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./logic.js'):root.PSRLevel,node?require('./config.js'):root.PSRLevelConfig);if(node)module.exports=api;else root.PSRLevelReport=api;})(typeof self!=='undefined'?self:this,function(L,CFG){
 'use strict';
 const isNum=v=>typeof v==='number'&&Number.isFinite(v);
 const fields=read=>read.kind==='pitching'?[['maxFb','Peak fastball','mph'],['typFb','Game fastball','mph']]:[['maxEv','Max exit velocity','mph'],['sixty','60-yard dash','s']].concat(read.family==='C'?[['pop','Pop time to 2B','s'],['cVelo','Catcher arm','mph']]:read.family==='OF'?[['ofVelo','Outfield arm','mph']]:[['ifVelo','Infield arm','mph']]);
 function evidence(input,read,today){
  const m=input.metrics||{},meta=input.meta||{},mt=input.methods||{};const defs=fields(read);const entered=defs.filter(([k])=>isNum(m[k]));
  const issues=[];const measured=meta.date?new Date(meta.date+'T12:00:00'):null;const now=today?new Date(today):new Date();
  if(!measured||!Number.isFinite(+measured))issues.push('Add the measurement date.');
  else if((now-measured)/86400000>180)issues.push('These measurements are over six months old. A fresh result would show your current tools.');
  if(!meta.source)issues.push('Record where the measurements came from.');
  if(read.kind==='pitching'&&!isNum(m.typFb))issues.push('Add your typical game fastball; a single peak does not describe a game outing.');
  if(entered.some(([k])=>k==='sixty')&&!(mt.sixty||meta.method==='hand'||meta.method==='electronic'))issues.push('Record hand versus electronic timing for your 60.');
  if((isNum(m.maxEv)||isNum(m.avgEv))&&!mt.ev)issues.push('Record whether exit velocity came from a tee, BP or a game.');
  if(mt.sixty==='hand'||meta.method==='hand')issues.push('Keep hand-timed sprint results separate from electronic results; no automatic correction is applied.');
  if(mt.evDevice==='blast'&&isNum(m.maxEv))issues.push('Confirm the exit-velocity reading comes from a ball-tracking measurement, rather than a bat-speed sensor.');
  if(!meta.link)issues.push('Add a public result link or report reference when you have one. A link does not verify the reading.');
  return {entered:entered.length,total:defs.length,label:issues.length?'Context to complete':'Measurement context recorded',issues,verified:false,sourceLabel:meta.source==='event'?'Event result, entered by player':meta.source==='device'?'Device report, entered by player':'Self-reported / not independently verified'};
 }
 function rows(read,category){
  const c=read.categories.find(c=>c.key===category)||read.categories.find(c=>c.highlighted)||read.categories[0];
  return {category:c,tools:read.toolKeys.map(k=>{const t=c.tools[k];const gap=t.status===L.S.BELOW?t.gap:null;return {key:k,label:CFG.TOOLS[k].label,value:t.value,unit:t.unit,target:t.band||'',threshold:t.threshold,status:t.status,gap,compared:c.compared.includes(k),note:t.note||t.reason||'',narrow:gap!=null&&((t.unit==='seconds'&&gap<=0.1)||(t.unit==='mph'&&gap<=1))};})};
 }
 function actionPlan(input,read,today){
  const e=evidence(input,read,today),todo=[];
  if(e.issues.length)todo.push({title:'Make the numbers comparable',detail:e.issues[0],href:'#edit-evidence',source:'NCSA_TOOLS'});
  const hasGap=read.categories.some(c=>c.compared.some(k=>c.tools[k].status===L.S.BELOW));
  if(hasGap)todo.push({title:'Pick a target to discuss with your coach',detail:'Use the comparison below to identify a measured gap. Retest in the same setting; the tool does not forecast how fast you will improve.',href:'#target-workbench',source:'ABCA'});
  todo.push({title:read.kind==='pitching'?'Show the whole pitcher':'Show your position on video',detail:read.kind==='pitching'?'Share game or bullpen footage of your fastball and secondary pitches. Coaches also need command, movement and competition context.':read.family==='C'?'Include receiving, blocking and accurate throws, plus hitting. Pop time alone cannot describe catching.':'Include hitting and defensive reps. A fast run time or hard throw cannot show decisions and game execution.',href:'email-coach.html',source:'ABCA'});
  todo.push({title:'Build a school list and start a conversation',detail:'Check academics, cost, roster and staff on official school pages. Share your actual numbers and a specific reason for that school.',href:'colleges.html',source:'KPB_EMAIL'});
  return todo.slice(0,3);
 }
 function snapshot(input,read){const m=input.metrics||{};return ['Class of '+input.gradYear+' | '+read.position+' | Throws '+input.throws+' | Bats '+input.bats,...fields(read).filter(([k])=>isNum(m[k])).map(([k,l,u])=>l+': '+(u==='s'?m[k].toFixed(2):m[k])+' '+u),input.meta&&input.meta.date?'Measured: '+input.meta.date:'Measurement date not recorded','Player-entered numbers; not independently verified.'].join('\n');}
 function handoff(input,read){const metricMap={maxFb:'fb_velo',typFb:'game_fb',maxEv:'exit_velo',sixty:'sixty',ifVelo:'if_velo',ofVelo:'of_velo',cVelo:'c_velo',pop:'pop'};const metrics={};/* all entered tools, so a two-way player's email gets pitching and position numbers */Object.keys(metricMap).forEach(k=>{if(isNum((input.metrics||{})[k]))metrics[metricMap[k]]=input.metrics[k];});return {version:2,created_at:new Date().toISOString(),profile:{grad_year:input.gradYear,primary_position:read.position,secondary_position:read.position===input.primary?input.secondary:input.primary,bats:input.bats,throws:input.throws,height_in:input.heightIn,weight_lb:input.weightLb,metrics},measurement:{...(input.meta||{}),methods:{...(input.methods||{})}},note:'Player-entered measurements only. Comparison labels are not included in the email.'};}
 function scenario(data,input,read,patch){const copy=JSON.parse(JSON.stringify(input));Object.entries(patch).forEach(([k,v])=>{if(!fields(read).some(([f])=>f===k))throw new Error('Unsupported scenario field');const r=CFG.RANGES[k];if(!isNum(v)||!r||v<r.hard[0]||v>r.hard[1])throw new Error('Enter a plausible '+k+' value');copy.metrics[k]=v;});if(isNum(copy.metrics.maxFb)&&isNum(copy.metrics.typFb)&&copy.metrics.typFb>copy.metrics.maxFb)throw new Error('Game fastball cannot exceed peak fastball');const result=L.evaluate(data,copy);return {input:copy,read:result.reads.find(r=>r.position===read.position),hypothetical:true};}
 function crossCheck(data,input,read){
  const levels=['D1 (all)','D2','D3 / NAIA','JUCO'];const m=input.metrics||{};
  const speed=read.position==='CF'?[[6.7,true],[6.9,true],[6.9,false],[7,false]]:['LF','RF'].includes(read.position)?[[6.8,true],[7,true],[6.9,false],[7,false]]:['SS','2B'].includes(read.position)?[[6.8,false],[6.9,false],[7,false],[7.1,false]]:null;
  return levels.map((level,j)=>{
   const tools=[];
   if(speed){const [limit,strict]=speed[j];tools.push({label:'60-yard dash',value:m.sixty,unit:'s',target:(strict?'Under ':'At most ')+limit.toFixed(2)+' s',met:isNum(m.sixty)?(strict?m.sixty<limit:m.sixty<=limit):null,note:'Published speed guidance; timing method matters.'});}
   if(read.kind==='pitching'){
    const threshold=[84,82,77,80][j];tools.push({label:'Typical game fastball',value:m.typFb,unit:'mph',target:['84 mph consistently; up to 95+','82–90+ mph','77–82 mph','80 mph consistently'][j],met:isNum(m.typFb)?m.typFb>=threshold:null,note:'Uses game velocity only. A peak fastball is not substituted; a band is not a ceiling.'});
   } else {
    const group=CFG.POSITION_GROUPS[read.position],pop=read.family==='C';
    const r=L.targetRow(data,'NS',level,pop?'C':group.nsThrow,pop?'Pop time to 2B':'Throwing velocity');
    if(r){const value=pop?m.pop:read.family==='OF'?m.ofVelo:m.ifVelo;const c=L.compareGuideline(r,value);tools.push({label:pop?'Pop time to 2B':'Position throw',value,unit:r.unit==='seconds'?'s':'mph',target:L.bandText(r),met:c.status===L.S.NO_INPUT?null:c.status===L.S.MEETS,note:pop?'The guidance concerns consistent, accurate throws. Your entry is a best result, so consistency still needs evaluation.':'Position throw, never fastball velocity.'});}
   }
   return {level,tools,source:'NCSA_TOOLS',pooled:level==='D1 (all)'||level==='D3 / NAIA'};
  });
 }
 return {fields,evidence,rows,actionPlan,snapshot,handoff,scenario,crossCheck};
});
