const { test }=require('node:test');const a=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const L=require('../recruiting/logic');
function init(sb,query='') {
 const window={PSRLogic:L,PSR_CONFIG:{},PSR_SB:sb}; const mem=new Map();
 const context={window,URLSearchParams,location:{search:query,origin:'https://example.com',pathname:'/my-recruiting.html'},sessionStorage:{getItem:k=>mem.get(k),setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)},setTimeout,console};
 vm.runInNewContext(fs.readFileSync('recruiting/data.js','utf8'),context);return window.PSRData.init();
}
test('without configuration the backend is read-only and sign-in fails clearly',async()=>{
 const api=init();a.equal(api.mode,'unavailable');await a.rejects(api.signIn('x@example.com'),/connect the recruiting database/);await a.rejects(api.table('saved_schools').insert({}),/connect/);
});
test('live directory errors are not replaced with incompatible fallback IDs',async()=>{
 const q={select(){return this},range(){return this},order(){return this},then(resolve){return Promise.resolve({data:null,error:{message:'Database unavailable'}}).then(resolve)}};
 const api=init({from:()=>q});a.equal(api.mode,'live');await a.rejects(api.listPrograms(),e=>e.message==='Database unavailable');
});
test('auth callbacks defer database work until Supabase callback has returned',async()=>{
 let listener;const api=init({auth:{onAuthStateChange(fn){listener=fn;}}});let called=false;
 api.onAuth(()=>{called=true;});listener();a.equal(called,false);await new Promise(r=>setTimeout(r,10));a.equal(called,true);
});
test('session errors are surfaced instead of pretending to be signed out',async()=>{
 const api=init({auth:{getSession:async()=>({error:new Error('Session failed'),data:null})}});await a.rejects(api.getUser(),/Session failed/);
});
