// Sign-in and account flows against a fake Supabase (CDN script and account function are stubbed).
// Run: NODE_PATH=$(npm root -g) node tests/auth.ui.js http://localhost:8098/
const BASE=(process.argv[2]||"http://localhost:8098/").replace(/\/?$/,"/");
const {chromium}=require("playwright");(async()=>{const b=await chromium.launch({executablePath:"/usr/bin/google-chrome"});const ctx=await b.newContext({viewport:{width:390,height:844}});
const stub=`window.supabase={createClient(){let session=null;const ls=[];const fire=e=>ls.forEach(f=>f(e,session));
 const mk=()=>{const res={data:[],error:null,count:0};const h={get(t,k){if(k==="then")return (r,j)=>Promise.resolve(res).then(r,j);if(k==="maybeSingle"||k==="single")return ()=>Promise.resolve({data:{username:"kid_23"},error:null});return ()=>px;}};const px=new Proxy({},h);return px;};
 return {from(){return mk()},rpc(){return Promise.resolve({data:false,error:null})},auth:{
  getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session&&session.user},error:null}),
  onAuthStateChange(f){ls.push(f);return{data:{subscription:{unsubscribe(){}}}}},
  signInWithPassword:async({email,password})=>{window.__calls.push("pw:"+email);if(password!=="GoodPass123")return{error:{message:"Invalid login credentials",status:400}};session={access_token:"t",user:{id:"u1",email}};fire("SIGNED_IN");return{data:{session},error:null}},
  setSession:async(s)=>{window.__calls.push("setSession");session={...s,user:{id:"u1",email:"kid@example.com"}};fire("SIGNED_IN");return{data:{session},error:null}},
  resetPasswordForEmail:async()=>({error:{code:"email_address_not_authorized",message:"Email address not authorized"}}),
  updateUser:async()=>({error:null}),signOut:async()=>{session=null;fire("SIGNED_OUT");return{error:null}}}}}};window.__calls=[];`;
await ctx.route(/supabase-js|@supabase/,r=>r.fulfill({status:200,contentType:"application/javascript",body:stub}));
await ctx.route(/functions\/v1\/account/,async r=>{const p=JSON.parse(r.request().postData());
 if(p.action==="signup")return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({session:{access_token:"a",refresh_token:"b"},username:p.username||null})});
 if(p.action==="login")return p.password==="GoodPass123"?r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({session:{access_token:"a",refresh_token:"b"}})}):r.fulfill({status:401,contentType:"application/json",body:JSON.stringify({error:"Wrong username or password."})});
 r.fulfill({status:400,body:"{}"});});
const page=await ctx.newPage();page.on("pageerror",e=>console.log("PAGEERR",e.message));
const go=async()=>{await page.goto(""+BASE+"my-recruiting.html");await page.locator("#rcGateForm").waitFor({timeout:8000});};
await go();console.log("default tab:",await page.locator('.rc-gate-tabs [aria-selected=true]').innerText());
await page.screenshot({path:"/tmp/gbashots/gate_create.png"});
// create
await page.fill('[name=email]','kid@example.com');await page.fill('[name=username]','Kid_23');await page.fill('[name=password]','GoodPass123');
await page.click('button[type=submit]');await page.waitForTimeout(600);console.log("no consent msg shown?", await page.locator('#rcGateForm').count());
await page.check('[name=consent]');await page.click('button[type=submit]');await page.waitForTimeout(2500);console.log('APP:',(await page.locator('#app').innerText()).slice(0,300).replace(/\n+/g,' | '));console.log(JSON.stringify(await page.evaluate(()=>window.__calls)));await page.waitForSelector('#acctBtn',{timeout:3000});console.log("signed up ->", await page.locator('.rc-userbar b').first().innerText(), page.url().split('/').pop());
// account dialog
await page.click('#acctBtn');await page.waitForSelector('#acctUser');await page.waitForTimeout(300);console.log("username prefill:",await page.inputValue('#acctUser'));await page.screenshot({path:"/tmp/gbashots/acct.png"});
await page.fill('#acctPw','NewPass1234');await page.click('#acctPwSave');await page.waitForTimeout(300);console.log("pw msg:",await page.locator('#acctMsg').innerText());
await page.keyboard.press('Escape');
// fresh page = signed out (stub resets). sign in by username wrong then right
await go();await page.click('[data-gate=signin]');await page.fill('[name=identifier]','kid_23');await page.fill('[name=password]','nope12345');await page.click('button[type=submit]');await page.waitForTimeout(500);console.log("wrong:",await page.locator('#rcGateMsg').innerText());
await page.screenshot({path:"/tmp/gbashots/gate_signin.png"});
await page.fill('[name=password]','GoodPass123');await page.click('button[type=submit]');await page.waitForSelector('#acctBtn',{timeout:8000});console.log("username sign-in ok");
await go();await page.click('[data-gate=signin]');await page.fill('[name=identifier]','Kid@Example.com');await page.fill('[name=password]','GoodPass123');await page.click('button[type=submit]');await page.waitForSelector('#acctBtn',{timeout:8000});console.log("email sign-in ok");
await go();await page.click('[data-gate=signin]');await page.click('[data-gate=forgot]');await page.fill('[name=email]','kid@example.com');await page.click('button[type=submit]');await page.waitForTimeout(500);console.log("forgot:",await page.locator('#rcGateMsg').innerText());
await go();await page.click('[data-gate=signin]');await page.fill('[name=password]','abc');await page.click('.rc-pw-show');console.log("show pw type:",await page.getAttribute('[name=password]','type'));
console.log("calls",JSON.stringify(await page.evaluate(()=>window.__calls)));
await b.close()})()
