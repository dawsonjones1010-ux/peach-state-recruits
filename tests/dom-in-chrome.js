// Runs the jsdom suites (tests/*.dom.js) unchanged in headless Chrome, for machines where jsdom
// can't be installed (no network). Each `new JSDOM(...)` becomes a same-origin iframe with fresh
// localStorage; fs reads become synchronous requests to the local static server.
// Usage: NODE_PATH=$(npm root -g) CHROME=/usr/bin/google-chrome node tests/dom-in-chrome.js http://localhost:8098/ tests/eleven.dom.js [more...]
const fs = require("node:fs"), path = require("node:path");
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8098/";
const files = process.argv.slice(3).length ? process.argv.slice(3) : ["tests/recruiting.dom.js", "tests/eleven.dom.js", "tests/roadmap.dom.js"];

const shim = `
const __fs={readFileSync:(p)=>{const x=new XMLHttpRequest();x.open('GET',p,false);x.send();if(x.status!==200)throw new Error('read '+p+' '+x.status);return x.responseText;},existsSync:(p)=>{const x=new XMLHttpRequest();x.open('HEAD',p,false);x.send();return x.status===200;}};
const __path={resolve:()=>'',join:(...p)=>('/'+p.filter(Boolean).join('/')).replace(/\\/+/g,'/'),dirname:(p)=>p.replace(/\\/[^/]*$/,'')};
const __fmt=(v)=>{try{return JSON.stringify(v)}catch(e){return String(v)}};
const __a={ok:(v,m)=>{if(!v)throw new Error('Assertion failed: '+(m||''));},equal:(x,y,m)=>{if(x!==y)throw new Error('Expected '+__fmt(y)+', got '+__fmt(x)+(m?': '+m:''));},deepEqual:(x,y,m)=>{if(__fmt(x)!==__fmt(y))throw new Error('Expected '+__fmt(y)+', got '+__fmt(x)+(m?': '+m:''));}};
__a.strictEqual=__a.equal;__a.deepStrictEqual=__a.deepEqual;
class __JSDOM{constructor(html,opts){opts=opts||{};try{localStorage.clear();sessionStorage.clear();}catch(e){}
 const f=document.createElement('iframe');f.style.cssText='width:1280px;height:900px';document.body.appendChild(f);const w=f.contentWindow;
 w.document.open();w.document.write(html);w.document.close();if(opts.url){const u=new URL(opts.url);w.history.replaceState(null,'',u.pathname+u.search+u.hash);}
 this.window=w;}}
const require=(m)=>({'jsdom':{JSDOM:__JSDOM},'node:fs':__fs,'fs':__fs,'node:path':__path,'path':__path,'node:assert/strict':__a,'node:assert':__a,'assert':__a})[m]||(()=>{throw new Error('No browser shim for '+m)})();
const __dirname='/tests';`;

async function runFile(browser, file) {
  const src = fs.readFileSync(path.resolve(file), "utf8")
    .replace(/https:\/\/preview\.example\//g, "'+location.origin+'/").replace(/''\+location/g, "location")
    .replace(/process\.exit\(1\)/g, "(window.__fail(String(e&&e.stack||e)),window.__done())")
    .replace(/process\.exitCode\s*=\s*1/g, "(window.__fail(String(e&&e.stack||e)),window.__done())");
  const page = await browser.newPage();
  const errs = [];
  page.on("console", m => console.log(m.text()));
  page.on("pageerror", e => errs.push(e.message));
  await page.route("**/rest/v1/**", r => r.request().method() === "GET" ? r.continue() : r.abort());
  await page.goto(BASE);
  let failed = null;
  await page.exposeFunction("__fail", (e) => { failed = e; });
  // The suites end with an async IIFE; finishing (or failing) it signals completion.
  const body = src.replace(/\}\)\(\)\.catch\(/, "})().then(()=>window.__done()).catch(");
  await page.evaluate((c) => new Promise((res) => { window.__done = res; const s = document.createElement("script"); s.textContent = c; document.body.appendChild(s); setTimeout(res, 120000); }), shim + "\n" + body);
  await page.close();
  if (!failed && errs.length) failed = errs.join("\n");
  return failed;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  let bad = 0;
  for (const f of files) {
    console.log("== " + f);
    const err = await runFile(browser, f);
    if (err) { bad++; console.error("FAILED " + f + "\n" + err); }
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
