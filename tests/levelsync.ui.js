// Find My Level results and accounts on a shared device (stubbed Supabase; user id comes from localStorage "__stubuser").
// Covers audit PSR-001/002: no cross-account import, explicit import of signed-out results, cleanup on sign-out/delete.
// Run: NODE_PATH=$(npm root -g) node tests/levelsync.ui.js http://localhost:8098/
const BASE=(process.argv[2]||"http://localhost:8098/").replace(/\/?$/,"/");
const {chromium}=require("playwright");
const stub=`(function(){const DBK="__stubdb";const db=()=>JSON.parse(localStorage.getItem(DBK)||'{"level_results":[]}');const put=d=>localStorage.setItem(DBK,JSON.stringify(d));
const uid=()=>localStorage.getItem("__stubuser")||"";
window.supabase={createClient(){
 const q=(t)=>{const mine=()=>(db()[t]||[]).filter(r=>r.user_id===uid()).slice().reverse();const h={get(o,k){
  if(k==="then")return (r,j)=>Promise.resolve({data:mine(),error:null}).then(r,j);
  if(k==="insert")return (row)=>{const d=db();(d[t]=d[t]||[]).push(Object.assign({created_at:new Date().toISOString(),user_id:uid()},row));put(d);return Promise.resolve({data:null,error:null})};
  if(k==="maybeSingle"||k==="single")return ()=>Promise.resolve({data:null,error:null});
  if(k==="limit")return (n)=>Promise.resolve({data:mine().slice(0,n),error:null});
  return ()=>px;}};const px=new Proxy({},h);return px;};
 const sess=()=>uid()?{access_token:"t",user:{id:uid(),email:uid()+"@example.com"}}:null;
 return {from:q,rpc:()=>Promise.resolve({data:false,error:null}),auth:{getSession:async()=>({data:{session:sess()},error:null}),getUser:async()=>({data:{user:sess()&&sess().user},error:null}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{localStorage.removeItem("__stubuser");return{error:null}}}}}};})();`;
let fails=0;const ok=(c,m)=>{console.log((c?"ok":"FAIL")+" - "+m);if(!c)fails++;};
async function runFml(p,ev){
 await p.goto(BASE+'find-my-level.html');await p.locator('#f_primary').waitFor();
 if(await p.locator('[data-fresh]').count())await p.click('[data-fresh]');
 await p.selectOption('#f_gradYear','2027');await p.selectOption('#f_primary','CF');await p.selectOption('#f_heightIn','6');await p.selectOption('[data-h=in]','0');await p.fill('#f_weightLb','180');await p.check('[name=throws][value=R]',{force:true});await p.check('[name=bats][value=R]',{force:true});await p.click('form[data-step="1"] button[type=submit]');
 await p.fill('#f_maxEv',ev);await p.fill('#f_sixty','6.75');await p.fill('#f_ofVelo','88');await p.click('form[data-step="2"] button[type=submit]');await p.fill('#f_date','2026-11-01');await p.click('form[data-step="3"] button[type=submit]');
 await p.locator('.lvl-results').waitFor();await p.waitForTimeout(800);
}
const rows=p=>p.evaluate(()=>JSON.parse(localStorage.getItem("__stubdb")||'{"level_results":[]}').level_results.map(r=>({u:r.user_id,ev:r.summary.handoff&&r.summary.handoff.profile&&r.summary.handoff.profile.metrics&&r.summary.handoff.profile.metrics.exit_velo,owner:r.summary.owner})));
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||"/usr/bin/google-chrome"});
 const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({status:200,contentType:"application/javascript",body:stub}));
 const p=await ctx.newPage();p.on("pageerror",e=>{console.log("PAGEERR",e.message);fails++;});
 await p.goto(BASE+'index.html');await p.evaluate(()=>localStorage.setItem("__stubuser","userA"));
 // A makes a result while signed in
 await runFml(p,'94');
 let r=await rows(p);ok(r.length===1&&r[0].u==="userA"&&r[0].ev===94,"A's result saved to A's account only");
 ok(/Saved to your account/.test(await p.locator('.lvl-acct-line').first().innerText()),"A sees it saved");
 ok(await p.evaluate(()=>!localStorage.getItem("psr_level_summary_v1")),"no signed-out copy left behind for A's result");
 // Switch to B on the same browser without using Sign out (worst case)
 await p.evaluate(()=>localStorage.setItem("__stubuser","userB"));
 await p.goto(BASE+'find-my-level.html');await p.locator('#f_primary').waitFor();await p.waitForTimeout(800);
 ok(await p.locator('.lvl-welcome').count()===0,"B does not see A's result in Find My Level");
 await p.goto(BASE+'recruiting-roadmap.html');await p.waitForTimeout(1000);
 ok(!/Power 4|Mid-Major|Low-Major/.test(await p.locator('#startSteps').innerText()),"B does not see A's level on Start Here");
 r=await rows(p);ok(r.length===1&&r.every(x=>x.u==="userA"),"nothing of A's was uploaded into B's account");
 ok(await p.evaluate(async()=>(await window.PSRLevelSync.pendingImport())===null),"A's account result is not offered to B as an import");
 // B signs out; a signed-out result is made on the device
 await p.evaluate(()=>localStorage.removeItem("__stubuser"));
 await runFml(p,'90');
 ok(/Sign in or create a free account/.test(await p.locator('.lvl-acct-line').first().innerText()),"signed-out result invites sign-in");
 r=await rows(p);ok(r.length===1,"signed-out result is not uploaded");
 // B signs in: no automatic upload, explicit import offered
 await p.evaluate(()=>localStorage.setItem("__stubuser","userB"));
 await p.goto(BASE+'recruiting-roadmap.html');await p.waitForTimeout(1000);
 r=await rows(p);ok(r.length===1,"signing in does not upload the device result on its own");
 ok(await p.evaluate(async()=>!!(await window.PSRLevelSync.pendingImport())),"device result is offered for import");
 await p.evaluate(async()=>{await window.PSRLevelSync.importAnon();});
 r=await rows(p);ok(r.length===2&&r[1].u==="userB"&&r[1].ev===90,"import adds it to B's account when B chooses");
 ok(await p.evaluate(()=>!localStorage.getItem("psr_level_summary_v1")),"imported result leaves the signed-out slot");
 // Second device for B gets B's result
 const seed=await p.evaluate(()=>localStorage.getItem("__stubdb"));
 const c2=await b.newContext({viewport:{width:390,height:844}});await c2.route(/supabase-js/,r=>r.fulfill({status:200,contentType:"application/javascript",body:stub}));
 await c2.addInitScript(s=>{if(!localStorage.getItem("__stubdb")){localStorage.setItem("__stubdb",s);localStorage.setItem("__stubuser","userB");}},seed);
 const p2=await c2.newPage();await p2.goto(BASE+'find-my-level.html');await p2.locator('.lvl-welcome').waitFor({timeout:5000});
 await p2.click('[data-reopen]');await p2.locator('.lvl-results').waitFor();
 ok(true,"B's result reopens on a second device");
 // Sign-out and delete cleanup
 await p.evaluate(()=>window.PSRLevelSync.forgetAccount());
 ok(await p.evaluate(()=>!localStorage.getItem("psr_level_summary_v1:acct")),"sign-out removes the account's copy from the device");
 await p.evaluate(()=>{localStorage.setItem("psr_fml_history_v1","[1]");localStorage.setItem("psr_level_summary_v1:acct",JSON.stringify({v:1,owner:"userB"}));window.PSRLevelSync.clearDevice(false);});
 ok(await p.evaluate(()=>!localStorage.getItem("psr_level_summary_v1:acct")&&!localStorage.getItem("psr_fml_history_v1")),"delete removes the account copy and device history");
 await b.close();console.log(fails?fails+" FAILED":"level sync checks passed");process.exitCode=fails?1:0;})();
