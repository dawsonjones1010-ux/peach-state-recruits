// Find My Level results saved to the account and reopened on a second device (stubbed Supabase).
// Run: NODE_PATH=$(npm root -g) node tests/levelsync.ui.js http://localhost:8098/
const BASE=(process.argv[2]||"http://localhost:8098/").replace(/\/?$/,"/");
const {chromium}=require("playwright");
const stub=`(function(){const DBK="__stubdb";const db=()=>JSON.parse(localStorage.getItem(DBK)||'{"level_results":[]}');const put=d=>localStorage.setItem(DBK,JSON.stringify(d));
window.__inserts=0;
window.supabase={createClient(){const session={access_token:"t",user:{id:"u1",email:"kid@example.com"}};
 const q=(t)=>{let rows=null;const res=()=>{const d=db();return {data:(d[t]||[]).slice().reverse(),error:null}};const h={get(o,k){
  if(k==="then")return (r,j)=>Promise.resolve(res()).then(r,j);
  if(k==="insert")return (row)=>{const d=db();(d[t]=d[t]||[]).push(Object.assign({created_at:new Date().toISOString()},row));put(d);window.__inserts++;return Promise.resolve({data:null,error:null})};
  if(k==="maybeSingle"||k==="single")return ()=>Promise.resolve({data:null,error:null});
  if(k==="limit")return (n)=>Promise.resolve({data:res().data.slice(0,n),error:null});
  return ()=>px;}};const px=new Proxy({},h);return px;};
 return {from:q,rpc:()=>Promise.resolve({data:false,error:null}),auth:{getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null})}}}};})();`;
let fails=0;const ok=(c,m)=>{console.log((c?"ok":"FAIL")+" - "+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||"/usr/bin/google-chrome"});
 const mk=async(seed)=>{const ctx=await b.newContext({viewport:{width:390,height:844}});await ctx.route(/supabase-js/,r=>r.fulfill({status:200,contentType:"application/javascript",body:stub}));
  await ctx.addInitScript(s=>{localStorage.setItem("sb-eqghenbqsbvifzkzkdwf-auth-token",JSON.stringify({access_token:"t",user:{email:"kid@example.com"}}));if(s&&!localStorage.getItem("__stubdb"))localStorage.setItem("__stubdb",s);},seed||null);
  const p=await ctx.newPage();p.on("pageerror",e=>{console.log("PAGEERR",e.message);fails++;});return {ctx,p};};
 // Device 1: run Find My Level while signed in
 let {ctx,p}=await mk();
 await p.goto(BASE+'find-my-level.html');await p.locator('#f_primary').waitFor();
 await p.selectOption('#f_gradYear','2027');await p.selectOption('#f_primary','CF');await p.selectOption('#f_heightIn','6');await p.selectOption('[data-h=in]','0');await p.fill('#f_weightLb','180');await p.check('[name=throws][value=R]',{force:true});await p.check('[name=bats][value=R]',{force:true});await p.click('form[data-step="1"] button[type=submit]');
 await p.fill('#f_maxEv','94');await p.fill('#f_sixty','6.75');await p.fill('#f_ofVelo','88');await p.click('form[data-step="2"] button[type=submit]');await p.fill('#f_date','2026-11-01');await p.click('form[data-step="3"] button[type=submit]');
 await p.locator('.lvl-results').waitFor();await p.waitForTimeout(800);
 ok(await p.evaluate(()=>window.__inserts)===1,"result saved to the account once");
 ok(/Saved to your account/.test(await p.locator('.lvl-acct-line').first().innerText()),"results say it's saved to the account");
 const seed=await p.evaluate(()=>localStorage.getItem("__stubdb"));
 await p.goto(BASE+'find-my-level.html');await p.locator('.lvl-welcome').waitFor({timeout:5000});
 ok(/Power 4/.test(await p.locator('.lvl-welcome').innerText()),"same device: welcome back shows the last level");
 await ctx.close();
 // Device 2: fresh browser, same account
 ({ctx,p}=await mk(seed));
 await p.goto(BASE+'find-my-level.html');await p.locator('.lvl-welcome').waitFor({timeout:5000});
 ok(true,"new device: welcome back appears from the account");
 await p.click('[data-reopen]');await p.locator('.lvl-results').waitFor();
 ok(/Power 4/.test(await p.locator('.lvl-tabpanel:not([hidden]) .lvl-match').innerText()),"new device: results reopen with the same level");
 await p.goto(BASE+'recruiting-roadmap.html');await p.waitForTimeout(1200);
 ok(/Power 4/.test(await p.locator('#startSteps').innerText()),"Start Here shows the level from the account");
 await p.goto(BASE+'find-my-level.html');await p.locator('[data-fresh]').click();
 ok(await p.locator('.lvl-welcome').count()===0 && await p.locator('#f_primary').count()===1,"Start fresh hides the box and shows the form");
 await ctx.close();
 // Signed out: the line invites sign-in
 const c3=await b.newContext({viewport:{width:390,height:844}});const p3=await c3.newPage();
 await p3.goto(BASE+'find-my-level.html');await p3.locator('#f_primary').waitFor();
 await p3.selectOption('#f_gradYear','2027');await p3.selectOption('#f_primary','CF');await p3.selectOption('#f_heightIn','6');await p3.selectOption('[data-h=in]','0');await p3.fill('#f_weightLb','180');await p3.check('[name=throws][value=R]',{force:true});await p3.check('[name=bats][value=R]',{force:true});await p3.click('form[data-step="1"] button[type=submit]');
 await p3.fill('#f_maxEv','94');await p3.fill('#f_sixty','6.75');await p3.fill('#f_ofVelo','88');await p3.click('form[data-step="2"] button[type=submit]');await p3.fill('#f_date','2026-11-01');await p3.click('form[data-step="3"] button[type=submit]');
 await p3.locator('.lvl-results').waitFor();await p3.waitForTimeout(600);
 ok(/Sign in or create a free account/.test(await p3.locator('.lvl-acct-line').first().innerText()),"signed out: results invite sign-in");
 await p3.screenshot({path:"/tmp/gbashots/acctline.png"});
 await b.close();console.log(fails?fails+" FAILED":"level sync checks passed");process.exitCode=fails?1:0;})();
