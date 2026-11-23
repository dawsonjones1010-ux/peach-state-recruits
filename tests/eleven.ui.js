// Real-browser acceptance suite for v22. Run against a local/staging site; uses preview accounts only.
const {chromium}=require('playwright');const a=require('node:assert/strict');const BASE=(process.argv[2]||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch(process.env.CHROME?{executablePath:process.env.CHROME}:{});let checks=0;const ok=(v,s)=>{a.ok(v,s);checks++;console.log('ok',s);};
 for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // No live API write is permitted in this suite.
  await context.route('**/rest/v1/**',r=>r.request().method()==='GET'?r.continue():r.abort());
  await page.goto(BASE+'find-my-level.html');await page.locator('#f_primary').waitFor();
  await page.selectOption('#f_gradYear','2027');await page.selectOption('#f_primary','CF');await page.selectOption('#f_heightIn','6');await page.selectOption('[data-h=in]','0');await page.fill('#f_weightLb','180');await page.check('[name=throws][value=R]',{force:true});await page.check('[name=bats][value=R]',{force:true});await page.click('form[data-step="1"] button[type=submit]');
  await page.fill('#f_maxEv','94');await page.fill('#f_sixty','6.75');await page.fill('#f_ofVelo','88');await page.click('form[data-step="2"] button[type=submit]');await page.fill('#f_date','2026-11-01');await page.click('form[data-step="3"] button[type=submit]');
  await page.locator('.lvl-results').waitFor();ok(await page.locator('.lvl-pfit li').count()===7,width+': seven level scores once');ok(/\d+\/100/.test(await page.locator('.lvl-match').innerText()),width+': fit score out of 100 visible');ok((await page.locator('.lvl-match-disc').innerText()).includes('not the chance of being recruited'),width+': fit disclaimer visible');
  ok(await page.locator('.lvl-board .lvl-pill-h').count()>=4,width+': orange section headers present');
  ok(await page.locator('.lvl-ring').count()===1,width+': one headline ring, not a split donut');
  ok(await page.locator('.lvl-pfit li.is-hl').getAttribute('data-level')==='mid',width+': mid-major is the primary target');
  ok((await page.locator('.lvl-pboard').innerText()).includes('6.75 s'),width+': path names the 60-yard gap');
  ok(await page.locator('.lvl-pcat:not(.is-na)').count()===3,width+': three scored categories');
  ok(!(await page.locator('.lvl-pcats').innerText()).match(/height|weight|GPA/i),width+': no height, weight or GPA score');
  ok(/\d+\/100/.test(await page.locator('.lvl-conf').innerText()),width+': confidence score shown');ok(await page.locator('.pro-cross-grid article').count()===4,width+': NCSA groups separate');ok(await page.locator('.lvl-onetap .lvl-tap').count()===4,width+': four next steps');
  await page.fill('[data-qwhat="0:sixty"]','6.6');await page.locator('[data-run-qwhat]').click();ok((await page.locator('#qwhatOut0').innerText()).includes('Hypothetical target'),width+': what-if identified');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': result fits viewport');await page.locator('[data-email-handoff]').click();await page.waitForURL('**/email-coach.html?from=level');await page.locator('#emailContext').waitFor();ok(await page.inputValue('[name=m_exit_velo]')==='94',width+': actual measurements transferred');
  for(const [name,value] of Object.entries({first_name:'Alex',last_name:'Rivera',high_school:'Test HS',contact_email:'alex@example.com',video_url:'https://video.example/skills'}))await page.fill('#emailContext [name='+name+']',value);
  await page.fill('[name=school]','Example University');await page.locator('[name=school]').press('Tab');await page.fill('[name=to]','coach@example.edu');await page.fill('[name=coach]','John Smith');await page.fill('[name=reason]','your academic offerings fit what I want to study');await page.check('[name=videoChecked]');await page.click('#ecGenerate');
  if(await page.locator('dialog[open]').count())await page.locator('dialog [data-v="1"]').click();
  ok((await page.inputValue('#ecBody')).includes('Alex Rivera'),width+': personal email generated');ok(!(await page.inputValue('#ecBody')).includes('Power conference'),width+': assigned tier not in email');
  await page.fill('#ecBody',(await page.inputValue('#ecBody'))+'\nMy own final sentence.');await page.fill('[name=coach]','James Smith');ok((await page.inputValue('#ecBody')).endsWith('My own final sentence.'),width+': edits preserved');
  await page.click('#ecOpen');ok(await page.locator('#ecConfirmOpen').count()===1,width+': final review before email app');ok((await page.locator('#ecConfirmOpen').getAttribute('href')).startsWith('mailto:'),width+': manual email handoff');await page.click('#ecCancelOpen');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+': email editor fits viewport');ok(errors.length===0,width+': no uncaught page errors: '+errors.join('; '));await context.close();
 }await browser.close();console.log(checks+' browser acceptance checks passed');})().catch(e=>{console.error(e);process.exit(1)});
