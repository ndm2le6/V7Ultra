
import './styles.css';
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.floor(n).toLocaleString('vi-VN');
const clamp = (v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const nowHour = () => new Date().getHours();
const isNight = () => nowHour() >= 19 || nowHour() < 5;
const isPetSleep = () => nowHour() >= 22 || nowHour() < 6;

const ITEMS = {
  food:[
    {id:'kibble', name:'Hạt cao cấp', icon:'🥣', priceG:80, hunger:26, fun:2},
    {id:'salmon', name:'Cá hồi mềm', icon:'🐟', priceG:180, hunger:38, fun:8},
    {id:'water', name:'Nước uống', icon:'💧', priceG:50, thirst:35},
    {id:'medicine', name:'Thuốc pet', icon:'💊', priceG:350, health:36},
    {id:'toyball', name:'Bóng đồ chơi', icon:'⚽', priceD:2, fun:30, energy:-8},
    {id:'bath', name:'Sữa tắm thơm', icon:'🫧', priceG:140, clean:38}
  ],
  tree:[
    {id:'waterTree', name:'Nước tưới cây', icon:'💧', priceG:65, water:30, growth:1},
    {id:'fertilizer', name:'Phân bón', icon:'🌿', priceG:220, growth:4, nutrient:20},
    {id:'pesticide', name:'Thuốc trừ sâu', icon:'🛡️', priceG:320, health:20},
    {id:'growBoost', name:'Tăng trưởng cao cấp', icon:'🧪', priceD:8, growth:18}
  ],
  decor:[
    {id:'petHouse', name:'Nhà pet êm', icon:'🏠', priceD:10},
    {id:'sakuraLamp', name:'Đèn Sakura', icon:'🏮', priceD:6},
    {id:'gardenPond', name:'Hồ mini', icon:'🪷', priceD:12}
  ]
};

const defaultState = () => ({
  level:1, xp:0, gold:500, diamond:20, room:'home',
  inventory:{kibble:2,water:2,waterTree:2,fertilizer:1},
  pet:{type:'cat', name:'Tam Thể', hunger:72, thirst:70, fun:74, clean:80, health:92, energy:78, affection:15, bored:12, last:Date.now(), sleeping:false, sick:false},
  tree:{growth:8, water:65, nutrient:48, health:90, fruit:0, stage:'seed', nextFruitAt:0, last:Date.now(), dead:false},
  notes:[{id:'math', title:'Toán', sub:'Lớp 1-12 · AI tutor', xp:0},{id:'lang', title:'Ngoại ngữ', sub:'Anh · Trung · Nhật · Hàn', xp:0},{id:'fit', title:'Luyện tập', sub:'Calo · thói quen', xp:0}],
  ai:{apiKey:'', model:'gemini-2.5-flash-lite', provider:'gemini'},
  chat:[{role:'rin', text:'Chào mừng đến Rin-NDM V7 Ultra. Ta sẽ giúp bạn học, chăm pet và phát triển vườn Sakura.'}],
  daily:{tasks:[], reset:''}
});
let state = load();

function load(){
  try{
    return {...defaultState(), ...(JSON.parse(localStorage.getItem('rin_v7_official')||'{}'))};
  }catch(e){ return defaultState(); }
}
function save(){ localStorage.setItem('rin_v7_official', JSON.stringify(state)); }

function xpNeed(lv){ return Math.floor(100 * Math.pow(lv, 1.45)); }
function addXp(x){
  state.xp += x;
  let reward = 0, gems = 0;
  while(state.level < 1000 && state.xp >= xpNeed(state.level)){
    state.xp -= xpNeed(state.level);
    state.level++;
    reward += 80 + state.level * 3;
    if(state.level % 10 === 0) gems += 1;
  }
  state.gold += reward;
  state.diamond += gems;
  if(reward || gems) toast(`Lên LV ${state.level}! +${reward} vàng ${gems?`+${gems} kim cương`:''}`);
}

function spend(item){
  const g = item.priceG||0, d = item.priceD||0;
  if(state.gold < g) return toast('Không đủ vàng'), false;
  if(state.diamond < d) return toast('Không đủ kim cương'), false;
  state.gold -= g; state.diamond -= d; return true;
}
function inv(id){ return state.inventory[id]||0; }
function addInv(id,n=1){ state.inventory[id]=(state.inventory[id]||0)+n; }

function updateDecay(){
  const now=Date.now();
  const hours=Math.min(72, Math.floor((now-(state.pet.last||now))/3600000));
  if(hours>0){
    for(let i=0;i<hours;i++){
      const sleep=isPetSleep();
      state.pet.hunger=clamp(state.pet.hunger-(sleep?2.2:4.5));
      state.pet.thirst=clamp(state.pet.thirst-(sleep?2.4:5));
      state.pet.fun=clamp(state.pet.fun-(sleep?0.6:3.2));
      state.pet.clean=clamp(state.pet.clean-(sleep?0.8:2.6));
      state.pet.energy=clamp(state.pet.energy+(sleep?7:-2.5));
      state.pet.bored=clamp(state.pet.bored+(sleep?-2:3.4));
      if(state.pet.hunger<20 || state.pet.thirst<20 || state.pet.clean<18) state.pet.health=clamp(state.pet.health-2.2);
    }
    state.pet.last=now;
  }
  const th=Math.min(72, Math.floor((now-(state.tree.last||now))/3600000));
  if(th>0){
    for(let i=0;i<th;i++){
      state.tree.water=clamp(state.tree.water-3.2);
      state.tree.nutrient=clamp(state.tree.nutrient-1.7);
      if(state.tree.water<15 || state.tree.nutrient<8) state.tree.health=clamp(state.tree.health-2.8);
      if(state.tree.health>60 && state.tree.water>25 && state.tree.nutrient>15 && !state.tree.dead) state.tree.growth=clamp(state.tree.growth+0.18,0,1000);
      if(state.tree.health<=0) state.tree.dead=true;
    }
    state.tree.last=now;
  }
  if(state.tree.growth >= 100 && !state.tree.dead){
    if(!state.tree.nextFruitAt) scheduleFruit();
    let loops=0;
    while(Date.now()>=state.tree.nextFruitAt && loops<4){
      state.tree.fruit += 1;
      scheduleFruit();
      loops++;
    }
  }
}
function scheduleFruit(){ state.tree.nextFruitAt = Date.now() + (8 + Math.floor(Math.random()*17))*3600000; }
function treeStage(){
  if(state.tree.dead) return 'Chết khô';
  const g=state.tree.growth;
  if(g<10) return 'Hạt giống';
  if(g<24) return 'Mầm non';
  if(g<48) return 'Cây non';
  if(g<75) return 'Trưởng thành';
  if(g<100) return 'Nở hoa';
  return 'Ra đào';
}

let renderer, scene, camera, petGroup, treeGroup, fruitGroup, clock = new THREE.Clock();
const mixers = [];

function init3D(){
  const canvas = document.createElement('canvas');
  canvas.id='world';
  $('.game').appendChild(canvas);
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, .1, 100);
  camera.position.set(0,3.8,9.2);
  camera.lookAt(0,1.5,0);
  const amb = new THREE.HemisphereLight(0xffffff, 0x334155, isNight()?1.1:1.55);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(isNight()?0xbfd7ff:0xfff1c4, isNight()?1.1:2.2);
  sun.position.set(-4,6,5); sun.castShadow=true; scene.add(sun);
  const groundGeo = new THREE.CylinderGeometry(4.2,4.8,.42,64);
  const groundMat = new THREE.MeshStandardMaterial({color:0x39b879, roughness:.72, metalness:.02});
  const ground = new THREE.Mesh(groundGeo, groundMat); ground.position.y=-.25; ground.receiveShadow=true; scene.add(ground);
  addGrass();
  treeGroup = new THREE.Group(); scene.add(treeGroup);
  fruitGroup = new THREE.Group(); treeGroup.add(fruitGroup);
  petGroup = new THREE.Group(); scene.add(petGroup);
  buildTree();
  buildPet();
  resize(); addEventListener('resize', resize);
  animate();
}
function resize(){
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
}
function mat(color, rough=.65){ return new THREE.MeshStandardMaterial({color, roughness:rough, metalness:.02}); }
function sphere(r, color, pos, scale=[1,1,1]){
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,24), mat(color));
  m.position.set(...pos); m.scale.set(...scale); m.castShadow=true; m.receiveShadow=true; return m;
}
function cyl(r1,r2,h,color,pos,rot=[0,0,0]){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,24), mat(color));
  m.position.set(...pos); m.rotation.set(...rot); m.castShadow=true; m.receiveShadow=true; return m;
}
function addGrass(){
  const grassMat = mat(0x7ee081,.85);
  for(let i=0;i<90;i++){
    const a=Math.random()*Math.PI*2, r=2.2+Math.random()*2.1;
    const blade=cyl(.01,.025,.18+Math.random()*.16,0x76d978,[Math.cos(a)*r,0.06,Math.sin(a)*r],[Math.random()*.3,0,Math.random()*.3]);
    scene.add(blade);
  }
}
function buildTree(){
  treeGroup.clear();
  const g = state.tree.growth;
  const dead=state.tree.dead, weak=state.tree.health<35;
  const size = clamp(g/100,.08,1.4);
  if(g<10){
    treeGroup.add(cyl(.22,.28,.18, dead?0x5b4636:0x8b5a2b,[0,.05,0]));
    if(g>3) treeGroup.add(sphere(.16, dead?0x6b5a45:0x4ade80,[0,.28,0],[.7,1.25,.7]));
    return;
  }
  const bark=dead?0x554136:0x8a4b2c;
  const flower=dead?0x6b5a59:(weak?0xd9a2a0:0xffb7d5);
  treeGroup.add(cyl(.22*size,.34*size,2.3*size,bark,[0,1.0*size,0],[0,0,.12]));
  for(let i=0;i<5;i++){
    const ang=(i/5)*Math.PI*2+.2;
    const branch=cyl(.05*size,.13*size,1.35*size,bark,[Math.cos(ang)*.45*size,1.75*size,Math.sin(ang)*.45*size],[Math.PI/2.8,0,ang]);
    treeGroup.add(branch);
  }
  const layers = Math.floor(3 + size*4);
  for(let i=0;i<layers;i++){
    const a=i*Math.PI*2/layers;
    const p=[Math.cos(a)*.72*size,2.25*size+(i%3)*.18*size,Math.sin(a)*.42*size];
    treeGroup.add(sphere(.72*size, flower, p, [1.25,.82,1.05]));
  }
  treeGroup.add(sphere(.92*size, flower, [0,2.62*size,0], [1.25,.88,1.1]));
  const fruitCount = Math.min(8,state.tree.fruit);
  for(let i=0;i<fruitCount;i++){
    const a=i*Math.PI*2/fruitCount + .5;
    const f=sphere(.11,0xff9f43,[Math.cos(a)*.85*size,2.22*size+(i%2)*.25,Math.sin(a)*.5*size],[1,.9,1]);
    fruitGroup.add(f);
  }
}
function buildPet(){
  petGroup.clear();
  const sleep=isPetSleep();
  petGroup.position.set(-1.5, .15, .65);
  petGroup.rotation.y=.25;
  const bodyColor = state.pet.type==='dog'?0xf7f2e7:0xd6a46f;
  const patch = state.pet.type==='dog'?0xffffff:0x222222;
  const body=sphere(.46, bodyColor,[0,.38,0],[1.35,.72,.72]);
  const head=sphere(.34, bodyColor,[.52,.58,0],[.95,.9,.9]);
  const snout=sphere(.15,0xf7d6c3,[.78,.54,0],[1.05,.65,.8]);
  petGroup.add(body,head,snout);
  petGroup.add(sphere(.04,0x111827,[.78,.66,.12]));
  petGroup.add(sphere(.04,0x111827,[.78,.66,-.12]));
  petGroup.add(sphere(.055,0x111827,[.91,.55,0]));
  petGroup.add(sphere(.15,patch,[.48,.78,.24],[.72,1.1,.35]));
  petGroup.add(sphere(.15,patch,[.48,.78,-.24],[.72,1.1,.35]));
  for(let i=0;i<4;i++){
    const x=i<2?.18:-.28, z=i%2?.25:-.25;
    const leg=cyl(.055,.075,.45,bodyColor,[x,.06,z],[0,0,0]);
    petGroup.add(leg);
  }
  const tail=cyl(.04,.06,.55,bodyColor,[-.72,.46,0],[0,0,1.25]);
  petGroup.add(tail);
  if(sleep){
    petGroup.rotation.z=-Math.PI/2.8; petGroup.position.y=.35;
    const zzz = sphere(.05,0xa5b4fc,[1.05,1.1,0],[1,1,1]); petGroup.add(zzz);
  }
}
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  if(treeGroup){
    treeGroup.rotation.z=Math.sin(t*1.2)*.018;
    treeGroup.rotation.y=Math.sin(t*.22)*.09;
  }
  if(petGroup){
    petGroup.position.y = .15 + Math.sin(t*2.1)*.025;
    petGroup.rotation.y = .25 + Math.sin(t*.9)*.12;
  }
  renderer.render(scene,camera);
}

function render(){
  updateDecay();
  $('.game').classList.toggle('night', isNight());
  const need = xpNeed(state.level);
  $('.hud').innerHTML = `
    <div class="hud-left">
      <div class="chip lv"><div class="lv-ring" style="--xp:${Math.floor(state.xp/need*100)}%">LV</div><b>${state.level}</b></div>
      <div class="chip">🪙 <b>${fmt(state.gold)}</b></div>
      <div class="chip">💎 <b>${fmt(state.diamond)}</b></div>
    </div>
    <div class="hud-right">
      <div class="chip">🍑 <b>${state.tree.fruit}</b></div>
      <div class="chip">${isNight()?'🌙':'☀️'}</div>
    </div>`;
  $('.needs').innerHTML = [
    ['🍗','No',state.pet.hunger],['💧','Khát',state.pet.thirst],['🎾','Vui',state.pet.fun],['🫧','Sạch',state.pet.clean],['❤️','Khỏe',state.pet.health],['⚡','NL',state.pet.energy]
  ].map(x=>`<div class="need"><i>${x[0]}</i><b>${x[1]} ${Math.round(x[2])}</b></div>`).join('');
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.room===state.room));
  save();
}
function $$ (s){ return [...document.querySelectorAll(s)]; }

function openSheet(id){ $$('.sheet').forEach(s=>s.classList.remove('show')); $('#'+id).classList.add('show'); }
function closeSheets(){ $$('.sheet').forEach(s=>s.classList.remove('show')); }
function toast(msg){
  const el=$('.toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2200);
}
function buyItem(id){
  const item=[...ITEMS.food,...ITEMS.tree,...ITEMS.decor].find(x=>x.id===id); if(!item) return;
  if(!spend(item)) return;
  addInv(id,1); addXp(6); toast(`Đã mua ${item.name}`); renderShop(); render();
}
function usePetItem(id){
  if(inv(id)<=0) return toast('Không có vật phẩm');
  const it=ITEMS.food.find(x=>x.id===id); if(!it) return;
  state.inventory[id]--;
  ['hunger','thirst','fun','clean','health','energy'].forEach(k=>{ if(it[k]) state.pet[k]=clamp(state.pet[k]+it[k]); });
  state.pet.affection=clamp(state.pet.affection+4); state.pet.bored=clamp(state.pet.bored-8);
  addXp(8); toast(`Pet thích ${it.name}`); render();
}
function useTreeItem(id){
  if(inv(id)<=0) return toast('Không có vật phẩm');
  const it=ITEMS.tree.find(x=>x.id===id); if(!it) return;
  state.inventory[id]--;
  state.tree.water=clamp(state.tree.water+(it.water||0));
  state.tree.nutrient=clamp(state.tree.nutrient+(it.nutrient||0));
  state.tree.health=clamp(state.tree.health+(it.health||0));
  state.tree.growth=clamp(state.tree.growth+(it.growth||0),0,1000);
  if(state.tree.dead && state.tree.health>30){ state.tree.dead=false; toast('Sakura đã hồi sinh'); }
  addXp(10); buildTree(); toast(`Đã dùng ${it.name}`); render();
}
function harvest(){
  if(state.tree.fruit<=0) return toast('Chưa có đào');
  const gold = state.tree.fruit*90;
  state.gold+=gold; addXp(state.tree.fruit*12); toast(`Bán ${state.tree.fruit} đào +${gold} vàng`);
  state.tree.fruit=0; buildTree(); render();
}
function petPet(){
  state.pet.fun=clamp(state.pet.fun+12); state.pet.affection=clamp(state.pet.affection+7); state.pet.bored=clamp(state.pet.bored-10);
  addXp(5); toast('Pet dụi đầu vào tay bạn'); render();
}
function play(){
  state.pet.fun=clamp(state.pet.fun+20); state.pet.energy=clamp(state.pet.energy-10); state.pet.hunger=clamp(state.pet.hunger-4);
  addXp(12); toast('Chơi cùng pet +EXP'); render();
}
function renderShop(tab='food'){
  const tabs=['food','tree','decor'];
  $('#shopContent').innerHTML = `
    <div class="shop-tabs">${tabs.map(t=>`<button class="${t===tab?'active':''}" data-tab="${t}">${t==='food'?'Pet':t==='tree'?'Cây':'Trang trí'}</button>`).join('')}</div>
    <div class="grid">${ITEMS[tab].map(it=>`
      <div class="card">
        <h3>${it.icon} ${it.name}</h3><small>${it.priceG?it.priceG+' vàng':''}${it.priceD?' '+it.priceD+' kim cương':''}</small>
        <div class="row"><button class="action gold" data-buy="${it.id}">Mua</button><button class="action" data-use="${it.id}">Dùng</button></div>
      </div>`).join('')}</div>`;
  $$('#shopContent [data-tab]').forEach(b=>b.onclick=()=>renderShop(b.dataset.tab));
  $$('#shopContent [data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));
  $$('#shopContent [data-use]').forEach(b=>b.onclick=()=>ITEMS.tree.some(x=>x.id===b.dataset.use)?useTreeItem(b.dataset.use):usePetItem(b.dataset.use));
}
async function renderStudy(){
  let data={grades:{}};
  try{ data=await fetch('/data/math-curriculum.json').then(r=>r.json()); }catch(e){}
  $('#studyContent').innerHTML = `
    <div class="grid">
      ${state.notes.map(n=>`<div class="card"><h3>📚 ${n.title}</h3><small>${n.sub}</small><div class="bar"><span style="width:${Math.min(100,n.xp/10)}%"></span></div><div class="row"><button class="action pink" data-test="${n.id}">AI Test</button><button class="action" data-note="${n.id}">Note</button></div></div>`).join('')}
    </div>
    <h2>Học viện Toán 1-12</h2>
    <div class="lesson-list">
      ${Object.entries(data.grades||{}).map(([g,v])=>`<div class="card"><h3>🔢 ${v.title}</h3><small>${v.chapters.length} chương · mở khóa theo LV</small><div class="row"><button class="action gem" data-math="${g}">Học lớp ${g}</button><button class="action" data-boss="${g}">Boss Test</button></div></div>`).join('')}
    </div>`;
  $$('#studyContent [data-test]').forEach(b=>b.onclick=()=>quickTest(b.dataset.test));
  $$('#studyContent [data-math]').forEach(b=>b.onclick=()=>mathPrompt(b.dataset.math));
  $$('#studyContent [data-boss]').forEach(b=>b.onclick=()=>quickTest('math-'+b.dataset.boss));
}
function quickTest(kind){
  const score=60+Math.floor(Math.random()*41), gold=80+score;
  state.gold+=gold; addXp(30+Math.floor(score/2));
  if(score>=92){ state.diamond+=1; toast(`Xuất sắc ${score}/100 +${gold} vàng +1 kim cương`); }
  else toast(`Hoàn thành ${score}/100 +${gold} vàng`);
  render();
}
function mathPrompt(grade){
  const text=`Tạo bài học Toán lớp ${grade} theo phong cách dễ hiểu, có 5 bài tập và đáp án.`;
  openSheet('chatSheet'); $('#chatInput').value=text;
}

async function askAI(text){
  state.chat.push({role:'you',text}); renderChat();
  const key=state.ai.apiKey.trim();
  if(!key){
    state.chat.push({role:'rin',text:'Chưa có API key. Giữ nút mic 7 giây hoặc mở cấu hình để nhập Gemini API. Ta vẫn có thể tạo bài mẫu offline.'});
    renderChat(); return;
  }
  const context=`Bạn là Nohara Rin, AI tutor trong game Rin-NDM V7. Trả lời tiếng Việt, thân thiện, giúp học tập, luyện tập, chăm pet/cây. Trạng thái: LV ${state.level}, vàng ${state.gold}, kim cương ${state.diamond}, pet ${JSON.stringify(state.pet)}, cây ${JSON.stringify(state.tree)}.`;
  try{
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.ai.model)}:generateContent?key=${encodeURIComponent(key)}`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{role:'user',parts:[{text:context+'\n\nNgười dùng: '+text}]}]})
    });
    const json=await res.json();
    const out=json?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('\n') || json?.error?.message || 'AI chưa trả lời được.';
    state.chat.push({role:'rin',text:out}); renderChat(); speak(out);
  }catch(e){ state.chat.push({role:'rin',text:'Lỗi mạng/API. Hãy kiểm tra key hoặc model.'}); renderChat(); }
}
function renderChat(){
  $('#chatLog').innerHTML=state.chat.map(m=>`<div class="card"><b>${m.role==='you'?'Bạn':'Nohara Rin'}</b><p>${m.text}</p></div>`).join('');
  save();
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  const u=new SpeechSynthesisUtterance(text.slice(0,360)); u.lang='vi-VN'; u.rate=1; speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function setupVoice(){
  const btn=$('#micBtn'); let timer, hold=false;
  btn.onpointerdown=()=>{ hold=false; timer=setTimeout(()=>{hold=true; openSheet('configSheet'); toast('Mở cấu hình API/model');},7000); };
  btn.onpointerup=()=>{ clearTimeout(timer); if(hold) return; voiceInput(); };
}
function voiceInput(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) return toast('Máy chưa hỗ trợ nhận giọng nói trong WebView');
  const r=new SR(); r.lang='vi-VN'; r.interimResults=false; r.maxAlternatives=1;
  r.onresult=e=>{ const t=e.results[0][0].transcript; askAI(t); };
  r.onerror=()=>toast('Không nghe được giọng nói');
  r.start(); toast('Đang nghe...');
}
function renderConfig(){
  $('#configContent').innerHTML=`
    <label>Gemini API key</label><input class="input" id="apiKey" value="${state.ai.apiKey}" placeholder="Dán API key">
    <label>Model</label><input class="input" id="model" value="${state.ai.model}">
    <div class="row"><button class="action gem" id="saveAI">Lưu cấu hình</button></div>`;
  $('#saveAI').onclick=()=>{ state.ai.apiKey=$('#apiKey').value.trim(); state.ai.model=$('#model').value.trim()||'gemini-2.5-flash-lite'; save(); toast('Đã lưu AI'); closeSheets(); };
}

function mount(){
  $('#app').innerHTML = `
  <div class="game">
    <div class="splash"><div><div class="logo">🐾</div><h1>Rin-NDM V7 Ultra</h1><p>Pet Academy · Sakura Garden · AI Tutor</p></div></div>
    <div class="hud"></div>
    <button class="chat" id="micBtn">🎙️</button>
    <div class="floating-actions"><button class="round" id="petBtn">🐾</button><button class="round" id="harvestBtn">🍑</button></div>
    <div class="scene-ui"><div class="needs"></div></div>
    <div class="toast"></div>
    <nav class="nav">
      <button data-room="home"><span>🏠</span><small>Nhà</small></button>
      <button data-room="garden"><span>🌸</span><small>Vườn</small></button>
      <button data-room="study"><span>📚</span><small>Học</small></button>
      <button data-room="game"><span>🎮</span><small>Game</small></button>
      <button data-room="shop"><span>🛒</span><small>Shop</small></button>
    </nav>
    <section class="sheet" id="petSheet"><button class="close">×</button><h2>Pet Companion</h2><div class="grid"><button class="action pink" id="petPet">Vuốt ve</button><button class="action gem" id="playPet">Chơi cùng</button><button class="action" data-use="kibble">Cho ăn</button><button class="action" data-use="water">Cho uống</button><button class="action" data-use="bath">Tắm</button><button class="action" data-use="medicine">Chữa bệnh</button></div></section>
    <section class="sheet" id="shopSheet"><button class="close">×</button><h2>Cửa hàng</h2><div id="shopContent"></div></section>
    <section class="sheet" id="studySheet"><button class="close">×</button><h2>Study Academy</h2><div id="studyContent"></div></section>
    <section class="sheet" id="gameSheet"><button class="close">×</button><h2>Mini Game học tập</h2>
      <div class="grid">
        <div class="card"><h3>⚔️ Quiz Boss</h3><small>Bài kiểm tra nhanh nhận vàng/EXP</small><button class="action gold" id="quizBoss">Chơi</button></div>
        <div class="card"><h3>🧠 Flashcard Battle</h3><small>Luyện phản xạ từ vựng</small><button class="action gold" id="flashBattle">Chơi</button></div>
        <div class="card"><h3>🏃 Fitness Quest</h3><small>Tính calo và bài tập</small><button class="action gold" id="fitQuest">Chơi</button></div>
        <div class="card"><h3>🔢 Math Sprint</h3><small>Toán tốc độ lớp 1-12</small><button class="action gold" id="mathSprint">Chơi</button></div>
      </div>
    </section>
    <section class="sheet" id="chatSheet"><button class="close">×</button><h2>Nohara Rin AI</h2>
      <div id="chatLog"></div>
      <textarea class="input" id="chatInput" placeholder="Hỏi bài, tạo test, luyện nói, tính calo..."></textarea>
      <div class="row"><button class="action pink" id="sendChat">Gửi</button><button class="action" id="speakLast">Đọc lại</button></div>
    </section>
    <section class="sheet" id="configSheet"><button class="close">×</button><h2>Cấu hình AI</h2><div id="configContent"></div></section>
  </div>`;
  init3D();
  renderShop(); renderStudy(); renderChat(); renderConfig(); render();
  setTimeout(()=>$('.splash').classList.add('hide'),1400);
  $$('.close').forEach(b=>b.onclick=closeSheets);
  $$('.nav button').forEach(b=>b.onclick=()=>{ state.room=b.dataset.room; render(); if(state.room==='shop') openSheet('shopSheet'); if(state.room==='study') {renderStudy(); openSheet('studySheet');} if(state.room==='game') openSheet('gameSheet'); if(state.room==='garden') toast(`Sakura: ${treeStage()} · ${Math.round(state.tree.growth)}%`); if(state.room==='home') closeSheets(); });
  $('#petBtn').onclick=()=>openSheet('petSheet');
  $('#harvestBtn').onclick=harvest;
  $('#petPet').onclick=petPet; $('#playPet').onclick=play;
  $$('#petSheet [data-use]').forEach(b=>b.onclick=()=>usePetItem(b.dataset.use));
  $('#quizBoss').onclick=()=>quickTest('boss');
  $('#flashBattle').onclick=()=>quickTest('flash');
  $('#fitQuest').onclick=()=>askAI('Tính giúp tôi bài tập hôm nay để giảm calo và tạo nhiệm vụ fitness.');
  $('#mathSprint').onclick=()=>quickTest('math');
  $('#sendChat').onclick=()=>{ const t=$('#chatInput').value.trim(); if(t){ $('#chatInput').value=''; askAI(t); } };
  $('#speakLast').onclick=()=>{ const last=[...state.chat].reverse().find(x=>x.role==='rin'); if(last) speak(last.text); };
  setupVoice();
  setInterval(()=>{ updateDecay(); buildTree(); buildPet(); render(); }, 5*60*1000);
}
mount();
