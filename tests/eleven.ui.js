// Real-browser acceptance suite for v22. Run against a local/staging site; uses preview accounts only.
const {chromium}=require('playwright');const a=require('node:assert/strict');const BASE=(process.argv[2]||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});let checks=0;const ok=(v,s)=>{a.ok(v,s);checks++;console.log('ok',s);};
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // No live API write is permitted in this suite.
  await context.route('**/rest/v1/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  await page.goto(BASE+'find-my-level.html');await page.locator('#f_primary').waitFor();
  await page.selectOption('#f_gradYear','2027');await page.selectOption('#f_primary','CF');await page.selectOption('#f_heightIn','6');await page.selectOption('[data-h=in]','0');await page.fill('#f_weightLb','180');await page.check('[name=throws][value=R]',{force:true});await page.check('[name=bats][value=R]',{force:true});await page.click('form[data-step="1"] button[type=submit]');
  await page.fill('#f_maxEv','94');await page.fill('#f_sixty','6.75');await page.fill('#f_ofVelo','88');await page.click('form[data-step="2"] button[type=submit]');await page.fill('#f_date','2026-11-01');await page.click('form[data-step="3"] button[type=submit]');
  await page.locator('.lvl-results').waitFor();ok(await page.locator('.lvl-read .lvl-lrow').count()===1,width+': seven categories once');ok((await page.locator('.lvl-match').innerText()).includes('67% match'),width+': match percentage visible');ok((await page.locator('.lvl-match-disc').innerText()).includes("aren't a guarantee of recruitment"),width+': match disclaimer visible');
  ok(await page.locator('.lvl-board .lvl-pill-h').count()>=3,width+': orange section headers present');
  ok(await page.locator('.lvl-ring').count()===1,width+': one headline ring, not a split donut');
  ok(await page.locator('.lvl-match-list li.is-hl').getAttribute('data-level')==='mid',width+': mid-major tile highlighted');
  ok((await page.locator('.lvl-outlook').innerText()).includes('6.75 s'),width+': outlook names the 60-yard gap');
  ok(await page.locator('.lvl-mbar').count()===3,width+': three scored metric bars');
  ok(!(await page.locator('.lvl-msum').innerText()).match(/height|weight|GPA/i),width+': no height, weight or GPA bar');
  ok((await page.locator('.lvl-how3').innerText()).toLowerCase().includes('enter your metrics'),width+': how-it-works strip visible');ok(await page.locator('.pro-cross-grid article').count()===4,width+': NCSA groups separate');ok(await page.locator('.pro-actions li').count()===3,width+': three next moves');
  await page.selectOption('[data-target="0"]','p4');ok((await page.locator('#workbenchRows0').innerText()).includes('0.05'),width+': target gap updates');
  await page.locator('.pro-scenario summary').click();await page.fill('[data-scenario="0:sixty"]','6.6');await page.locator('[data-run-scenario]').click();ok((await page.locator('#scenarioResult0').innerText()).includes('Hypothetical only'),width+': scenario identified');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': result fits viewport');await page.locator('[data-email-handoff]').click();await page.waitForURL('**/email-coach.html?from=level');await page.locator('#emailContext').waitFor();ok(await page.inputValue('[name=m_exit_velo]')==='94',width+': actual measurements transferred');
  for(const [name,value] of Object.entries({first_name:'Alex',last_name:'Rivera',high_school:'Test HS',contact_email:'alex@example.com',video_url:'https://video.example/skills'}))await page.fill('#emailContext [name='+name+']',value);
  await page.fill('[name=school]','Example University');await page.locator('[name=school]').press('Tab');await page.fill('[name=to]','coach@example.edu');await page.fill('[name=coach]','John Smith');await page.fill('[name=reason]','your academic offerings fit what I want to study');await page.check('[name=videoChecked]');await page.click('#ecGenerate');
  if(await page.locator('dialog[open]').count())await page.locator('dialog [data-v="1"]').click();
  ok((await page.inputValue('#ecBody')).includes('Alex Rivera'),width+': personal email generated');ok(!(await page.inputValue('#ecBody')).includes('Power conference'),width+': assigned tier not in email');
  await page.fill('#ecBody',(await page.inputValue('#ecBody'))+'\nMy own final sentence.');await page.fill('[name=coach]','James Smith');ok((await page.inputValue('#ecBody')).endsWith('My own final sentence.'),width+': edits preserved');
  await page.click('#ecOpen');ok(await page.locator('#ecConfirmOpen').count()===1,width+': final review before email app');ok((await page.locator('#ecConfirmOpen').getAttribute('href')).startsWith('mailto:'),width+': manual email handoff');await page.click('#ecCancelOpen');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': email editor fits viewport');ok(errors.length===0,width+': no uncaught page errors: '+errors.join('; '));await context.close();
 }await browser.close();console.log(checks+' browser acceptance checks passed');})().catch(e=>{console.error(e);process.exit(1)});
