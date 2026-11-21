/* Public planning worksheets. No accounts, recruitment predictions or automatic outreach. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PSRRoadmap=factory();})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const SOURCES=[
    {id:'ncaa',name:'NCAA: how recruiting works',url:'https://www.ncaa.org/eligibility-center/recruiting/',use:'Student-led communication, academic fit, recruiting periods and school compliance.'},
    {id:'academics',name:'NCAA: initial eligibility',url:'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/',use:'Approved core courses, counselor review, transcripts and eligibility-account tasks. Overall GPA alone does not establish eligibility.'},
    {id:'scranton',name:'University of Scranton: baseball recruiting',url:'https://athletics.scranton.edu/sports/2023/5/9/baseball-recruiting-info.aspx',use:'A real program requests a questionnaire, video, schedule and coach context. Other programs set their own process.'},
    {id:'clu',name:'Cal Lutheran: college athletics recruitment',url:'https://www.callutheran.edu/guides/college-athletics-recruitment/',use:'Personal outreach, academic and campus fit, questions about positions and choosing a college beyond baseball. Its general timelines do not override baseball-specific rules.'},
    {id:'cost',name:'Federal Student Aid: evaluating aid offers',url:'https://studentaid.gov/articles/evaluating-financial-aid-offers/',use:'Compare full annual costs and grants/scholarships. Loans and work-study are not a reduction in net price.'},
    {id:'naia',name:'NAIA: prospective student-athletes',url:'https://www.naia.org/student-athletes/prospective/',use:'NAIA has a separate eligibility pathway. Confirm the current requirements directly.'},
    {id:'njcaa',name:'NJCAA: compliance resources',url:'https://www.njcaa.org/compliance',use:'Use current association resources and the specific college compliance office for JUCO questions.'},
    {id:'d3',name:'NCAA: Division III eligibility',url:'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/division-iii/',use:'DIII does not offer athletic scholarships; merit and need-based aid may still be available.'},
    {id:'apple',name:'Apple: Mail Privacy Protection',url:'https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/',use:'Email images may load without a reader engaging. An open is not proof of coach interest.'}
  ];
  const TASKS={
    academics:{title:'Review your courses with your counselor',body:'Check graduation progress and NCAA-approved core courses. Keep overall GPA separate from NCAA core-course GPA. Ask which eligibility account, transcripts and tasks apply to your pathway.',href:'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/',action:'Open eligibility guidance',source:'academics'},
    coach:{title:'Ask your current coach for a candid evaluation',body:'Discuss your current tools, game performance, development priorities and programs worth researching. Ask permission before sharing a coach as a reference.',href:'find-my-level.html',action:'Compare your measurements',source:'clu'},
    video:{title:'Make your film easy to evaluate',body:'Put your name, graduation year and position first. Show clear, recent baseball actions and test the link while signed out. A highlight clip is a starting point for evaluation.',href:'#video',action:'Build a film checklist',source:'scranton'},
    shortlist:{title:'Build a school list you would actually attend',body:'Research majors, admission, location, annual net cost and baseball fit across appropriate levels. A current roster does not prove a future opening.',href:'colleges.html',action:'Research colleges',source:'clu'},
    outreach:{title:'Write to the right coach with a real reason',body:'Use the current official staff page. Introduce yourself, include academics, film and schedule, and ask a specific question about evaluation. Check rules before expecting a reply.',href:'email-coach.html',action:'Write an introduction',source:'scranton'},
    questionnaire:{title:'Complete each program’s recruiting process',body:'Use the school’s official questionnaire when available, and record what you sent. A questionnaire or camp registration is not an offer.',href:'colleges.html',action:'Find official program links',source:'scranton'},
    camp:{title:'Choose an evaluation opportunity with a purpose',body:'Before paying, confirm class/position eligibility, who will be there, your academic fit, all-in cost and refund terms. A general camp invitation alone does not establish recruiting interest.',href:'#camp',action:'Check a camp',source:'ncaa'},
    update:{title:'Follow up with useful new information',body:'Keep a log of actual replies, requested video, calls and next actions. Share new film, performance or a schedule when relevant; an email-open count is not verified interest.',href:'my-recruiting.html#tracker',action:'Open your tracker',source:'apple'},
    cost:{title:'Compare written terms and the real annual cost',body:'Ask about roster status, remaining evaluation, aid amount, renewal conditions and deadlines. Compare full cost minus grants and scholarships. Confirm verbal statements in writing.',href:'#cost',action:'Compare college costs',source:'cost'},
    apply:{title:'Keep applications and eligibility moving',body:'Confirm each school’s admissions, financial-aid and deposit deadlines directly. Review eligibility-account tasks and transcript needs. Do not assume a baseball conversation is admission.',href:'https://www.ncaa.org/eligibility-center/initial-eligibility-requirements/',action:'Review eligibility tasks',source:'academics'}
  };
  const STAGES={
    middle:{label:'Before high school',focus:'Build skills, enjoy the game and learn your options.',order:['coach','academics','video','shortlist']},
    freshman:{label:'9th grade',focus:'Build a strong academic and baseball foundation.',order:['academics','coach','video','shortlist','questionnaire']},
    sophomore:{label:'10th grade',focus:'Get your film, courses and research organized.',order:['academics','video','coach','shortlist','questionnaire','outreach','camp']},
    junior:{label:'11th grade',focus:'Lead your outreach and turn replies into clear next steps.',order:['shortlist','video','outreach','questionnaire','academics','camp','update','cost']},
    senior:{label:'12th grade',focus:'Confirm realistic options, deadlines, roster terms and cost.',order:['apply','update','shortlist','outreach','cost','video','academics','camp']}
  };
  const VIDEO_COMMON=[
    ['identity','Identify yourself','Name, graduation year, position, school/team and jersey number. Show an approved contact email; keep transcripts and private details off public video.'],
    ['recent','Date and label the footage','Label recent game versus practice footage and measurement dates. Avoid implying a peak result is your typical game performance.'],
    ['access','Test the exact link','Open it signed out on a phone. Check permissions, sound if relevant, picture quality and that the player is easy to identify.'],
    ['simple','Let coaches see the baseball','Lead with useful actions. Keep the view steady and clear. Remove long introductions and effects that obscure the action.'],
    ['schedule','Offer a way to evaluate you further','Have your current game schedule and longer game footage available when a coach requests them.']
  ];
  const FILM={
    P:[['delivery','Show the delivery','Use clear side and behind-catcher views when safely available. Show the full delivery and ball flight.'],['pitches','Show your actual pitch mix','Include fastballs and other pitches you use in games. Label game velocity separately from a peak and name the measurement source.'],['game','Add game sequences','Include command, sequences and results rather than only isolated hardest throws.']],
    C:[['receiving','Show receiving and blocking','Use a clear angle to see glove work, body position and recovery.'],['throws','Show throws and accuracy','Show throws to second base with the full receive-to-catch action visible. Label pop-time method and whether it is a best or typical result.'],['hitting','Include hitting','Use clear swings from the side and game contact. Label any measured exit velocity and context.']],
    IF:[['fielding','Show varied infield actions','Routine ground balls, forehand/backhand, movement through the ball and throws with the target visible.'],['hitting','Show hitting and game contact','Include a clear side view and game swings. Label tee, front toss, batting practice or game measurements accurately.'],['running','Show running if available','A clearly filmed run or home-to-first action adds context. Label distance and timing method; do not mix different tests.']],
    OF:[['fielding','Show outfield reads and movement','Include approaches to ground balls and fly balls with enough space to see the route.'],['throws','Show throws to a target','Keep release, flight and target visible. Label measured arm velocity with method/date if provided.'],['hitting','Show hitting and running','Include clear swings, game contact and running footage when available. Label distance and timing method.']],
    '1B':[['fielding','Show first-base work','Show receiving throws, picks, footwork around the bag, ground balls and throws.'],['hitting','Show hitting and game contact','Include a clear side view and game contact; label measured exit velocity and how it was recorded.'],['movement','Show movement in context','Include range and baseball actions. A single body-size or speed number does not establish college fit.']]
  };
  function plan(stage,done){const s=STAGES[stage]||STAGES.junior;return s.order.map(id=>({...TASKS[id],id,done:done?.[id]===true}));}
  function film(position){return VIDEO_COMMON.concat(FILM[position]||FILM.IF).map(([id,title,body])=>({id,title,body}));}
  function number(value){if(!['string','number'].includes(typeof value)||String(value).trim()==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=1000000?n:null;}
  function annualCost(row={}){
    const keys=['tuition','housing','other','gifts'],values=Object.fromEntries(keys.map(k=>[k,number(row[k])])),missing=keys.filter(k=>values[k]===null);
    const total=values.tuition===null||values.housing===null||values.other===null?null:Math.round((values.tuition+values.housing+values.other)*100)/100;
    const net=missing.length?null:Math.round(Math.max(0,total-values.gifts)*100)/100;
    const budget=number(row.budget),loans=number(row.loans),work=number(row.work);
    return {complete:missing.length===0,missing,total,net,loans,work,budget,gap:net!==null&&budget!==null?Math.round(Math.max(0,net-budget)*100)/100:null,excessAid:total!==null&&values.gifts!==null&&values.gifts>total};
  }
  const CAMP_QUESTIONS=[
    ['eligible','The official page allows my class, age and position.'],
    ['fit','I would consider this school academically and personally.'],
    ['staff','I confirmed which target coaches will attend and their evaluation role.'],
    ['purpose','I know what I want evaluated and what the camp actually provides.'],
    ['refund','I checked cancellation, refund and attendance terms.']
  ];
  function campDecision(answers={},costs={}){
    const keys=['registration','travel','hotel','other'],values=keys.map(k=>number(costs[k])),complete=values.every(v=>v!==null);
    const total=complete?Math.round(values.reduce((a,b)=>a+b,0)*100)/100:null,budget=number(costs.budget);
    const unknown=CAMP_QUESTIONS.filter(([k])=>!['yes','no'].includes(answers[k])).map(([k])=>k);
    const no=CAMP_QUESTIONS.filter(([k])=>answers[k]==='no').map(([k])=>k);
    let label='Check the missing details',reason='Confirm the items below before deciding whether to pay.';
    if(answers.eligible==='no'||(total!==null&&budget!==null&&total>budget)){label='Hold before booking';reason=answers.eligible==='no'?'This camp does not match the eligibility you entered. Ask the organizer before registering.':'The full estimate exceeds your stated budget. Review alternatives or costs with your family.';}
    else if(!unknown.length&&!no.length&&complete&&budget!==null){label='Ready for a family decision';reason='Your worksheet is complete and within your stated budget. Confirm current details on the official page; this is not a recommendation or evidence of coach interest.';}
    return {label,reason,total,complete,budget,unknown,no};
  }
  function coverage(programs){const visible=programs.filter(p=>p.record_status!=='hidden');return {total:visible.length,checked:visible.filter(p=>p.record_status==='verified'&&p.last_checked).length,academics:visible.filter(p=>p.academic_source_url&&p.academic_year&&[p.avg_net_price,p.tuition_in_state,p.admission_rate].some(v=>v!==null&&v!==undefined&&v!=='')).length,cost:visible.filter(p=>p.academic_source_url&&p.academic_year&&number(p.avg_net_price)!==null).length,staff:visible.filter(p=>/^https?:\/\//.test(p.staff_url||'')).length};}
  return {SOURCES,TASKS,STAGES,CAMP_QUESTIONS,plan,film,number,annualCost,campDecision,coverage};
});
