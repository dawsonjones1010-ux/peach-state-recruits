// DOM integration tests with real application code and local fixture storage.
// jsdom has no layout engine: this does NOT certify mobile layout or live magic-link auth.
const { JSDOM } = require('jsdom'); const fs=require('node:fs'); const path=require('node:path'); const a=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'); const wait=()=>new Promise(r=>setTimeout(r,30));let checks=0;
const check=(x,label)=>{a.ok(x,label);checks++;console.log('ok',label);};
function create(page,query='?demo=1') {
 const html=fs.readFileSync(path.join(ROOT,page),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const dom=new JSDOM(html,{url:'https://preview.example/'+page+query,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;const errors=[];
 w.addEventListener('error',e=>errors.push(e.error)); w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.scrollTo=()=>{};w.alert=()=>{};w.PSR={toast:()=>{},initNav:()=>{}};w.TextEncoder=TextEncoder;
 const RealDate=w.Date;w.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-20T12:00:00Z']));}static now(){return +new RealDate('2026-11-20T12:00:00Z');}};
 w.fetch=async url=>({json:async()=>JSON.parse(fs.readFileSync(path.join(ROOT,String(url)),'utf8'))});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
 const load=file=>w.eval(fs.readFileSync(path.join(ROOT,file),'utf8'));
 ['recruiting/logic.js','recruiting/data.js','recruiting/ui.js'].forEach(load);
 return {w,load,api:w.PSRData.init(),errors,dom};
}
function input(w,form,name,value){const e=form.elements.namedItem(name);a.ok(e,'field '+name);e.value=value;return e;}
function submit(w,form,button){const event=new w.Event('submit',{bubbles:true,cancelable:true});Object.defineProperty(event,'submitter',{value:button||null});form.dispatchEvent(event);}
(async()=>{
 let t=create('my-recruiting.html','');t.load('recruiting/hub.js');await wait();check(t.api.mode==='unavailable','missing configuration never silently enables demo accounts');check(t.w.document.body.textContent.includes('Account features unavailable'),'unavailable account features explained');a.equal(t.w.document.querySelector('#rcGateForm'),null);t.dom.window.close();
 t=create('my-recruiting.html');await t.api.signIn('player@example.com');
 const programs=await t.api.listPrograms();const p=programs.find(p=>p.name==='University of Georgia');
 await t.api.table('saved_schools').insert({program_id:p.id,stage:'researching',interest:'high'});
 await t.api.saveProfile({first_name:'Alex',last_name:'Rivera',grad_year:2028,primary_position:'SS',high_school:'Test HS',contact_email:'alex@example.com'});
 t.w.location.hash='#emails';t.load('recruiting/hub.js');await wait();await wait();
 let f=t.w.document.querySelector('#composer');check(!!f,'email composer renders');check(f.elements.namedItem('body').value.includes('Alex'),'draft uses player profile');
 input(t.w,f,'body','My custom message');f.elements.namedItem('body').dispatchEvent(new t.w.Event('input'));
 input(t.w,f,'coach','John Smith');f.elements.namedItem('coach').dispatchEvent(new t.w.Event('input'));
 check(f.elements.namedItem('body').value==='My custom message','coach field does not erase edited message');
 t.w.document.querySelector('#saveDraft').click();await wait();check((await t.api.table('email_drafts').list()).length===1,'draft saves');
 t.w.document.querySelector('#markSent').click();let sf=t.w.document.querySelector('#sent');check(!!sf,'sent confirmation opens');submit(t.w,sf,sf.querySelector('[value=ok]'));await wait();await wait();
 let comms=await t.api.table('communications').list();check(comms.length===1,'sent confirmation creates one tracker record');check((await t.api.table('saved_schools').list())[0].stage==='contacted','sent confirmation updates saved school stage');
 await t.api.logEmailSent(comms[0].draft_id,'2026-11-20',null,null);check((await t.api.table('communications').list()).length===1,'retry remains idempotent');
 let resolved=false;const promise=t.w.PSRUI.confirmDialog('Confirm?').then(v=>{resolved=true;return v;});t.w.document.querySelector('dialog').close();a.equal(await promise,false);check(resolved,'dialog close settles confirmation as cancel');
 t.w.location.hash='#plan';await wait();check(t.w.document.querySelectorAll('[data-task]').length>0,'personal plan renders');
 const task=t.w.document.querySelector('#addTask');input(t.w,task,'title','Talk with my high school coach');submit(t.w,task);await wait();check((await t.api.table('plan_tasks').list()).some(x=>x.title==='Talk with my high school coach'),'custom task saves using named form control');
 const camp=(await t.api.listCamps())[0];await t.api.table('saved_camps').insert({camp_id:camp.id,status:'interested'});
 await t.api.signOut();await wait();check(!!t.w.document.querySelector('#rcGateForm'),'sign-out removes private workspace immediately');
 await t.api.signIn('other@example.com');await wait();await wait();check((await t.api.table('saved_schools').list()).length===0,'second demo account has separate saved schools');check(!t.w.document.querySelector('#app').textContent.includes('Talk with my high school coach'),'second account does not display prior account tasks');
 check(t.errors.length===0,'hub has no uncaught DOM errors');t.dom.window.close();
 t=create('colleges.html');t.load('recruiting/colleges.js');await wait();check(t.w.document.querySelectorAll('.rc-card').length===25,'directory paginates');
 t.w.location.hash='#school=%E0%A4%A';await wait();check(t.w.document.querySelector('#detail').textContent.includes('School not found'),'malformed school hash handled safely');
 t.w.location.hash='#school='+p.slug;await wait();t.w.document.querySelector('#back').click();await wait();check(!t.w.location.hash,'back returns directly to finder');check(t.errors.length===0,'finder has no uncaught DOM errors');t.dom.window.close();
 t=create('camps.html');t.load('recruiting/camps.js');await wait();check(t.w.document.querySelectorAll('.rc-camp').length===4,'four seeded camp listings render at fixed test date');t.w.document.querySelector('[data-est]').click();await wait();check(!!t.w.document.querySelector('dialog[open]'),'travel dialog renders');check(t.errors.length===0,'camps have no uncaught DOM errors');t.dom.window.close();
 t=create('admin-recruiting.html');await t.api.signIn('admin@example.com');t.w.location.hash='#programs';t.load('recruiting/admin.js');await wait();await wait();check(!!t.w.document.querySelector('[data-editp]'),'admin program list renders');t.w.document.querySelector('[data-editp]').click();await wait();check(!!t.w.document.querySelector('[name=staff_url]'),'official staff link editable');check(!!t.w.document.querySelector('[name=majors_url]'),'major catalog link editable');let pf=t.w.document.querySelector('#pf');input(t.w,pf,'staff_url','https://example.edu/baseball/staff');submit(t.w,pf);await wait();await wait();check(!t.w.document.querySelector('dialog[open]'),'admin program edits save');
 check((await t.api.listProgramsAdmin()).some(p=>p.staff_url==='https://example.edu/baseball/staff'),'staff URL persists');
 t.w.location.hash='#camps';await wait();t.w.document.querySelector('#addC').click();await wait();const cf=t.w.document.querySelector('#cf');input(t.w,cf,'title','Local fixture camp');input(t.w,cf,'start_date','2026-12-15');input(t.w,cf,'source_url','https://example.edu/camp');submit(t.w,cf);await wait();await wait();check((await t.api.listCamps()).some(c=>c.title==='Local fixture camp'),'admin camp creation saves');
 check(t.errors.length===0,'admin has no uncaught DOM errors');t.dom.window.close();
 console.log(`${checks} DOM checks passed`);
})().catch(e=>{console.error(e);process.exit(1)});
