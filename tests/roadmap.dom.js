/* Observable worksheet behavior; layout is checked separately in a real browser. */
const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');let checks=0;
function check(v,label){a.ok(v,label);checks++;console.log('ok',label);}
function page(stored,hash=''){
 const html=fs.readFileSync(path.join(ROOT,'recruiting-roadmap.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const dom=new JSDOM(html,{url:'https://preview.example/recruiting-roadmap.html'+hash,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,errors=[];
 w.addEventListener('error',e=>errors.push(e.error));w.confirm=()=>true;w.print=()=>{};w.PSR={initNav(){},async copyText(t){w.copied=t;}};
 if(stored!==undefined)w.localStorage.setItem('psr_roadmap_v1',stored);
 ['recruiting/calendar.js','recruiting/roadmap.js','recruiting/roadmap-ui.js'].forEach(f=>w.eval(fs.readFileSync(path.join(ROOT,f),'utf8')));
 return {dom,w,d:w.document,errors};
}
function input(p,selector,value,event='input'){const el=p.d.querySelector(selector);a.ok(el,selector);el.value=value;el.dispatchEvent(new p.w.Event(event,{bubbles:true}));return el;}
(async()=>{
 let p=page();check(!!p.d.querySelector('#stage'),'public roadmap loads without an account');
 input(p,'#stage','freshman','change');check(p.d.querySelector('[data-task]').dataset.task==='academics','freshman plan prioritizes academic preparation');
 let cb=p.d.querySelector('#task-academics');cb.checked=true;cb.dispatchEvent(new p.w.Event('change',{bubbles:true}));check(p.d.querySelector('progress').value===1,'checkmark updates plan progress');
 check(p.w.localStorage.length===0,'worksheet does not persist without consent');
 p.d.querySelector('#tab-cost').click();check(p.d.querySelector('#panel-plan').hidden&&!p.d.querySelector('#panel-cost').hidden,'tabs change the visible worksheet');
 for(const [key,val]of Object.entries({tuition:'20000',housing:'12000',other:'3000',gifts:'15000',loans:'10000',work:'2000'}))input(p,`[data-school="0"] [name="${key}"]`,val);
 let out=p.d.querySelector('[data-cost-result="0"]').textContent;check(out.includes('$20,000.00 / year'),'cost comparison shows net price before borrowing');check(out.includes('Loans entered: $10,000.00'),'loan amount is reported separately');
 input(p,'[data-school="0"] [name="gifts"]','');check(p.d.querySelector('[data-cost-result="0"]').textContent.includes('Complete the four'),'clearing gift aid removes the complete price');
 input(p,'[data-school="0"] [name="gifts"]','0');check(p.d.querySelector('[data-cost-result="0"]').textContent.includes('$35,000.00 / year'),'explicit zero gift aid is valid');
 p.d.querySelector('#tab-camp').click();for(const s of p.d.querySelectorAll('#campForm select'))input(p,`#campForm [name="${s.name}"]`,'yes');
 for(const [key,val]of Object.entries({registration:'200',travel:'50',hotel:'0',other:'25',budget:'300'}))input(p,`#campForm [name="${key}"]`,val);
 check(p.d.querySelector('#campResult').textContent.includes('Ready for a family decision'),'complete affordable camp worksheet reaches a family decision');
 input(p,'#campForm [name="budget"]','250');check(p.d.querySelector('#campResult').textContent.includes('Hold before booking'),'over-budget trip is flagged');
 input(p,'#campForm [name="hotel"]','');check(p.d.querySelector('#campResult').textContent.includes('Incomplete'),'blank camp cost is never free');
 const remember=p.d.querySelector('#rememberPlan');remember.checked=true;remember.dispatchEvent(new p.w.Event('change',{bubbles:true}));
 const stored=p.w.localStorage.getItem('psr_roadmap_v1');check(!!stored,'explicit device opt-in saves worksheet');check(!stored.includes('first_name'),'worksheet contains no account profile fields');
 check(p.errors.length===0,'worksheet interactions have no uncaught errors');p.dom.window.close();
 p=page(stored,'#cost');check(p.d.querySelector('#stage').value==='freshman','saved school stage restores');check(p.d.querySelector('#task-academics').checked,'saved checklist restores');check(p.d.querySelector('[data-school="0"] [name="tuition"]').value==='20000','saved cost input restores');check(!p.d.querySelector('#panel-cost').hidden,'direct cost link opens correct tab');
 p.d.querySelector('#tab-plan').click();await p.d.querySelector('#copyPlan').onclick();check(p.w.copied.includes('[x] Review your courses'),'copy includes completed steps and actual selected stage');
 p.d.querySelector('#tab-plan').dispatchEvent(new p.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check(p.d.querySelector('#tab-video').getAttribute('aria-selected')==='true','keyboard arrows navigate tabs');
 input(p,'#position','P','change');check(p.d.querySelector('#filmResults').textContent.includes('pitch mix'),'pitcher film checklist shows pitch context');
 input(p,'#position','C','change');check(p.d.querySelector('#filmResults').textContent.includes('receiving and blocking'),'catcher film checklist changes to catcher skills');
 p.d.querySelector('#clearPlan').click();check(p.w.localStorage.length===0,'clear removes persistent worksheet');check(p.d.querySelector('[data-school="0"] [name="tuition"]').value==='','clear removes current cost entries');check(!p.d.querySelector('#rememberPlan').checked,'clear revokes device save');p.dom.window.close();
 p=page('{broken');check(p.d.querySelector('#saveStatus').textContent.includes('could not be read'),'corrupt storage is explained');check(!!p.d.querySelector('#stage'),'corrupt storage leaves tools usable');p.dom.window.close();
 p=page(JSON.stringify({version:1,stage:'bad',position:'QB',schools:[{name:'<img src=x onerror=alert(1)>',tuition:'Infinity'}]}));check(!p.d.querySelector('.rm-school img'),'restored strings cannot inject markup');check(p.d.querySelector('#stage').value==='junior','invalid stored selections fall back safely');check(p.d.querySelector('[data-school="0"] [name="tuition"]').value==='','nonfinite stored money is withheld');p.dom.window.close();
 console.log(`${checks} roadmap DOM checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
