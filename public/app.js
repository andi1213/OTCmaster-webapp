// ── STATE ──
let currentScreen = 'screen-content';
let screenHistory = [];
let simState = {
  subId: '', patientType: '', comorbidityId: '',
  messages: [], counselingMessages: [],
  selectedIngredients: [], selectedProducts: [],
  ingMode: 'choice_desc', prodMode: 'name_desc',
  evalQAs: [], evaluation: ''
};

// ── SETTINGS ──
function getApiKey(){ return localStorage.getItem('otc_api_key')||'' }
function getModel(){ return localStorage.getItem('otc_model')||'gpt-4o-mini' }
function showSettings(){
  document.getElementById('api-key-input').value = getApiKey();
  document.getElementById('model-select').value = getModel();
  document.getElementById('settings-modal').classList.remove('hidden');
}
function hideSettings(){ document.getElementById('settings-modal').classList.add('hidden') }
function saveSettings(){
  const key = document.getElementById('api-key-input').value.trim();
  const model = document.getElementById('model-select').value;
  if(key) localStorage.setItem('otc_api_key', key); else localStorage.removeItem('otc_api_key');
  localStorage.setItem('otc_model', model);
  hideSettings();
  showToast('설정 저장 완료');
}

// ── NAVIGATION ──
function showScreen(id){
  if(currentScreen !== id) screenHistory.push(currentScreen);
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  currentScreen = id;
  document.getElementById('btn-back').classList.toggle('hidden', screenHistory.length === 0);
  document.getElementById(id).scrollTop = 0;
}
function goBack(){
  if(screenHistory.length === 0) return;
  const prev = screenHistory.pop();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(prev).classList.add('active');
  currentScreen = prev;
  document.getElementById('btn-back').classList.toggle('hidden', screenHistory.length === 0);
}
function switchMode(mode){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.tab[data-mode="${mode}"]`).classList.add('active');
  screenHistory = [];
  document.getElementById('btn-back').classList.add('hidden');
  if(mode==='content'){ showScreen('screen-content'); document.getElementById('topbar-title').textContent='내용 정리'; }
  else if(mode==='recommend'){ showScreen('screen-recommend'); document.getElementById('topbar-title').textContent='빠른 추천'; }
  else if(mode==='sim'){ showScreen('screen-sim'); document.getElementById('topbar-title').textContent='복약지도 시뮬레이션'; buildSimCatList(); }
}

function showToast(msg){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2000);
}

function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

// ── MODE 1: CONTENT ──
function buildCategoryList(filter=''){
  const c = document.getElementById('category-list');
  const q = filter.toLowerCase();
  let html = '';
  OTC_CATEGORIES.forEach(cat=>{
    const subs = cat.subCategories.filter(s=>{
      if(!q) return true;
      if(s.name.toLowerCase().includes(q)) return true;
      const d = DRUG_DATA[s.id];
      if(d){
        if(d.ingredients.some(i=>i.name.toLowerCase().includes(q))) return true;
        if(d.products.some(p=>p.name.toLowerCase().includes(q)||p.ingredient.toLowerCase().includes(q))) return true;
      }
      return false;
    });
    if(!subs.length) return;
    html += `<div class="cat-group"><div class="cat-group-title">${cat.icon} ${cat.name}</div>`;
    subs.forEach(s=>{
      html += `<div class="sub-item" onclick="showContentDetail('${esc(s.id)}')"><span>${esc(s.name)}</span><span class="arrow">›</span></div>`;
    });
    html += '</div>';
  });
  if(!html) html = '<div style="text-align:center;padding:40px;color:#999">검색 결과가 없습니다</div>';
  c.innerHTML = html;
}
function filterCategories(){ buildCategoryList(document.getElementById('content-search').value) }

function showContentDetail(subId){
  document.getElementById('topbar-title').textContent = subId;
  const content = CONTENT_DATA[subId];
  const drugs = DRUG_DATA[subId];
  let html = '';
  if(content && content.length){
    html += '<div class="section-label">📖 학습 내용</div>';
    content.forEach(s=>{ html += `<div class="card"><h3>${esc(s.title)}</h3><div class="body">${esc(s.body)}</div></div>`; });
  }
  if(drugs && drugs.ingredients.length){
    html += `<div class="section-label">🧪 주요 성분 (${drugs.ingredients.length})</div>`;
    drugs.ingredients.forEach(i=>{ html += `<div class="ing-card"><div class="name">${esc(i.name)}</div><div class="desc">${esc(i.description)}</div></div>`; });
  }
  if(drugs && drugs.products.length){
    html += `<div class="section-label">💊 대표 제품 (${drugs.products.length})</div>`;
    drugs.products.forEach(p=>{ html += `<div class="prod-card"><div class="info"><div class="pname">${esc(p.name)}</div><div class="ping">${esc(p.ingredient)}</div></div><div class="badge">${esc(p.form)}</div></div>`; });
  }
  if(!content && !drugs) html = '<div style="text-align:center;padding:40px;color:#999">데이터가 준비중입니다</div>';
  document.getElementById('content-detail-body').innerHTML = html;
  showScreen('screen-content-detail');
}

// ── MODE 3: SIMULATION ──
const PATIENT_TYPES = [
  {id:'adult', label:'🧑 일반 성인', desc:'20~50대, 특별한 기저질환 없음'},
  {id:'child', label:'👶 어린이 (보호자 동반)', desc:'만 3~10세 소아, 부모가 대신 방문'},
  {id:'pregnant', label:'🤰 임산부', desc:'20~30대 여성, 임신 16~28주'},
  {id:'elderly', label:'👴 노인', desc:'65세 이상, 기저질환 보유, 다약제 복용'},
  {id:'comorbidity', label:'🏥 기저질환자', desc:'특정 기저질환이 있는 환자'},
  {id:'random', label:'🎲 랜덤', desc:'랜덤으로 환자 유형 선택'},
];

const COMORBIDITY_TYPES = [
  {id:'hypertension', label:'고혈압', prompt:'고혈압으로 암로디핀·로자탄 계열 항고혈압제를 복용 중입니다. 슈도에페드린(코막힘약)·NSAIDs 장기 복용은 혈압을 올릴 수 있으므로 주의가 필요합니다.'},
  {id:'diabetes', label:'당뇨', prompt:'2형 당뇨로 메트포르민을 복용 중입니다. 상처 회복이 느리고 감염에 취약하며, 일부 약의 혈당 영향에 주의가 필요합니다.'},
  {id:'renal_failure', label:'만성 신부전(CKD)', prompt:'만성 신부전 3단계(CKD 3)로 신기능이 저하되어 있습니다. NSAIDs·마그네슘·신독성 약물 금기 또는 감량이 필요합니다.'},
  {id:'liver_disease', label:'간질환(간경화/지방간)', prompt:'간경화 또는 중등도 지방간으로 간기능이 저하되어 있습니다. 아세트아미노펜은 감량(1일 2g 이하), 간 대사 약물에 주의가 필요합니다.'},
  {id:'asthma', label:'천식/COPD', prompt:'천식으로 흡입기를 사용 중입니다. 아스피린·NSAIDs 유발 천식 가능성이 있으며, 베타차단제 성분 주의가 필요합니다.'},
  {id:'glaucoma', label:'녹내장', prompt:'폐쇄각 녹내장 진단을 받았습니다. 항콜린 작용 약물(부스코판·1세대 항히스타민)이 안압을 올릴 수 있어 주의가 필요합니다.'},
  {id:'bph', label:'전립선비대(BPH)', prompt:'전립선비대로 배뇨 장애가 있습니다. 항콜린제·1세대 항히스타민·슈도에페드린은 요폐를 유발할 수 있습니다.'},
  {id:'heart_failure', label:'심부전', prompt:'심부전으로 이뇨제를 복용 중입니다. NSAIDs는 수분 저류를 일으켜 심부전을 악화시킬 수 있으며, 고나트륨 제제도 주의가 필요합니다.'},
  {id:'peptic_ulcer', label:'위궤양/GERD', prompt:'위궤양 또는 역류성 식도염이 있습니다. NSAIDs·아스피린은 금기이며, 위 점막 보호 약물이 우선입니다.'},
  {id:'thyroid', label:'갑상선 질환', prompt:'갑상선 기능 저하증으로 레보티록신을 복용 중입니다. 칼슘·철분·제산제 등과 복용 간격이 중요하며, 요오드 함유 제제(베타딘 대량)는 주의가 필요합니다.'},
  {id:'anticoagulant', label:'항응고제 복용 중 (와파린/NOAC)', prompt:'와파린 또는 NOAC(다비가트란 등)을 복용 중입니다. NSAIDs·아스피린·오메가3·나토키나제 등 출혈 위험 증가 약물에 주의가 필요합니다.'},
  {id:'nsaid_allergy', label:'NSAIDs 과민 / 아스피린 천식', prompt:'이부프로펜·아스피린 등 NSAIDs에 과민 반응(두드러기·호흡곤란) 병력이 있습니다. NSAIDs 계열 전체가 금기이며, 아세트아미노펜이 대안입니다.'},
];

const PATIENT_CONSTRAINTS = {
  adult: '당신은 20~50대 일반 성인입니다. 특별한 기저질환은 없습니다.',
  child: '당신은 만 3~10세 어린이의 보호자(엄마 또는 아빠)입니다. 절대로 성인 본인이 아닙니다. 반드시 "우리 아이가", "애가" 등의 표현을 사용하세요. 어린이 용량, 소아용 제형(시럽/츄어블), 연령 제한을 확인해야 하는 상황입니다.',
  pregnant: '당신은 임신 16~28주 임산부(20~30대 여성)입니다. 절대로 남성이 아닙니다. 반드시 "임신 중이라", "아기한테 괜찮은지" 등의 표현을 사용하세요. 태아에 안전한 약을 원하고, 약 먹어도 되는지 걱정이 많습니다.',
  elderly: '당신은 70대 노인입니다. 반드시 고령자로 행동하세요. 고혈압약, 당뇨약 등 2~3가지 약을 이미 복용 중입니다. 신기능이 약간 저하되어 있고, 글씨가 작으면 읽기 어렵습니다.',
};

function buildSimCatList(){
  const c = document.getElementById('sim-category-list');
  let html = '';
  OTC_CATEGORIES.forEach(cat=>{
    const valid = cat.subCategories.filter(s=>DRUG_DATA[s.id]);
    if(!valid.length) return;
    html += `<div class="cat-group"><div class="cat-group-title">${cat.icon} ${cat.name}</div>`;
    valid.forEach(s=>{
      html += `<div class="sub-item" onclick="selectSimCategory('${esc(s.id)}')"><span>${esc(s.name)}</span><span class="arrow">›</span></div>`;
    });
    html += '</div>';
  });
  c.innerHTML = html;
}

function selectSimCategory(subId){
  simState.subId = subId;
  document.getElementById('topbar-title').textContent = subId + ' — 대상자 선택';
  let html = '';
  PATIENT_TYPES.forEach(pt=>{
    if(pt.id === 'comorbidity'){
      html += `<div class="patient-card" onclick="showComorbidityList()"><div class="label">${pt.label}</div><div class="desc">${pt.desc}</div></div>`;
    } else {
      html += `<div class="patient-card" onclick="startSim('${pt.id}')"><div class="label">${pt.label}</div><div class="desc">${pt.desc}</div></div>`;
    }
  });
  document.getElementById('patient-type-list').innerHTML = html;
  showScreen('screen-sim-patient');
}

function showComorbidityList(){
  document.getElementById('topbar-title').textContent = '기저질환 선택';
  let html = '<h2 class="section-title">기저질환 선택</h2>';
  COMORBIDITY_TYPES.forEach(c=>{
    html += `<div class="patient-card" onclick="startSimComorbidity('${c.id}')" style="margin:0 16px 10px"><div class="label">🏥 ${esc(c.label)}</div><div class="desc">${esc(c.prompt.substring(0,60))}...</div></div>`;
  });
  document.getElementById('patient-type-list').innerHTML = html;
}

function startSimComorbidity(comorbidityId){
  simState.comorbidityId = comorbidityId;
  startSim('comorbidity');
}

async function startSim(patientId){
  // API Key는 서버에 내장되어 있거나, 사용자가 설정에서 입력
  if(patientId === 'random'){
    const types = ['adult','child','pregnant','elderly'];
    patientId = types[Math.floor(Math.random()*types.length)];
  }
  simState.patientType = patientId;
  simState.messages = [];
  simState.counselingMessages = [];
  simState.selectedIngredients = [];
  simState.selectedProducts = [];
  simState.evalQAs = [];
  simState.evaluation = '';

  document.getElementById('topbar-title').textContent = '🎯 ' + simState.subId;
  document.getElementById('chat-messages').innerHTML = `<div class="chat-msg system">시나리오 생성 중<span class="loading-dots"></span></div>`;
  showScreen('screen-sim-chat');

  const drugs = DRUG_DATA[simState.subId];
  const ingList = drugs ? drugs.ingredients.map(i=>i.name).join(', ') : '';

  let constraint;
  if(patientId === 'comorbidity'){
    const c = COMORBIDITY_TYPES.find(t=>t.id===simState.comorbidityId);
    constraint = `당신은 기저질환이 있는 환자입니다.\n환자 특성 (기저질환): ${c ? c.prompt : ''}\n기저질환 관련 약을 이미 복용 중이며, 병용 금기를 확인해야 합니다.`;
  } else {
    constraint = PATIENT_CONSTRAINTS[patientId] || PATIENT_CONSTRAINTS.adult;
  }

  const systemPrompt = `당신은 한국의 약국에 방문한 환자입니다.
카테고리: ${simState.subId}

## 환자 설정 (반드시 준수)
${constraint}

## 규칙
- 한국어로 자연스럽게 대화하세요.
- 의학 용어 대신 일반적인 표현을 사용하세요.
- 2~3문장 이내로 답하세요.
- 위 '환자 설정'을 절대 어기지 마세요.
- 관련 성분: ${ingList}`;

  simState.systemPrompt = systemPrompt;

  const result = await callAPI('/api/chat', {
    apiKey: getApiKey(), model: getModel(),
    systemPrompt,
    messages: [{role:'user', content:'환자로서 약국에 들어와 첫 마디를 해주세요. 증상을 2~3문장으로 호소하세요.'}]
  });

  const chatArea = document.getElementById('chat-messages');
  if(result.error){ chatArea.innerHTML = `<div class="chat-msg system">오류: ${result.error}</div>`; return; }
  simState.messages = [{role:'assistant', content:result.content}];
  chatArea.innerHTML = `<div class="chat-msg patient">${esc(result.content)}</div>`;
}

async function sendChat(){
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if(!msg) return;
  input.value = '';
  const chatArea = document.getElementById('chat-messages');
  chatArea.innerHTML += `<div class="chat-msg pharmacist">${esc(msg)}</div>`;
  simState.messages.push({role:'user', content:msg});
  chatArea.innerHTML += `<div class="chat-msg system">환자 응답 중<span class="loading-dots"></span></div>`;
  chatArea.scrollTop = chatArea.scrollHeight;

  const result = await callAPI('/api/chat', {
    apiKey: getApiKey(), model: getModel(),
    systemPrompt: simState.systemPrompt,
    messages: simState.messages
  });

  const loading = chatArea.querySelector('.chat-msg.system:last-child');
  if(loading && loading.textContent.includes('응답 중')) chatArea.removeChild(loading);

  if(result.error){ chatArea.innerHTML += `<div class="chat-msg system">오류: ${result.error}</div>`; return; }
  simState.messages.push({role:'assistant', content:result.content});
  chatArea.innerHTML += `<div class="chat-msg patient">${esc(result.content)}</div>`;
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── INGREDIENT SELECT ──
function goToIngredientSelect(){
  document.getElementById('topbar-title').textContent = '성분 선택';
  simState.ingMode = 'choice_desc';
  renderIngredientScreen();
  showScreen('screen-sim-ingredient');
}

function setIngMode(mode){
  simState.ingMode = mode;
  document.querySelectorAll('#ing-mode-chips .btn-toggle').forEach(b=>b.classList.remove('active'));
  document.querySelector(`#ing-mode-chips .btn-toggle[data-mode="${mode}"]`).classList.add('active');
  renderIngredientScreen();
}

function renderIngredientScreen(){
  const mode = simState.ingMode;
  const writtenArea = document.getElementById('ing-text-mode');
  const checkArea = document.getElementById('ing-checkbox-mode');

  if(mode === 'written'){
    writtenArea.classList.remove('hidden');
    checkArea.classList.add('hidden');
  } else {
    writtenArea.classList.add('hidden');
    checkArea.classList.remove('hidden');
    buildIngredientGroups();
  }
}

function addWrittenIngredient(){
  const input = document.getElementById('ing-text-input');
  const val = input.value.trim();
  if(!val) return;
  val.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean).forEach(name=>{
    if(!simState.selectedIngredients.includes(name)) simState.selectedIngredients.push(name);
  });
  input.value = '';
  updateWrittenChips();
}

function updateWrittenChips(){
  const container = document.getElementById('written-chips');
  if(!container) return;
  container.innerHTML = simState.selectedIngredients.map(n =>
    `<div class="chip">${esc(n)} <span class="remove" onclick="removeIngredient('${esc(n)}');updateWrittenChips()">✕</span></div>`
  ).join('');
}

function buildIngredientGroups(){
  const container = document.getElementById('ingredient-groups');
  const showDesc = simState.ingMode === 'choice_desc';
  let html = '<div class="selected-chips" id="ing-chips"></div>';

  OTC_CATEGORIES.forEach((cat, catIdx) => {
    const subs = cat.subCategories.filter(s => DRUG_DATA[s.id] && DRUG_DATA[s.id].ingredients.length > 0);
    if(!subs.length) return;
    const allIngs = [];
    const seen = new Set();
    subs.forEach(s => {
      DRUG_DATA[s.id].ingredients.forEach(ing => {
        if(!seen.has(ing.name)){ seen.add(ing.name); allIngs.push(ing); }
      });
    });
    if(!allIngs.length) return;
    const expanded = cat.subCategories.some(s => s.id === simState.subId);
    html += `<div class="group-header" onclick="toggleGroup('ing-group-${catIdx}')">${cat.icon} ${cat.name} (${allIngs.length}) <span id="ing-arrow-${catIdx}">${expanded?'▲':'▼'}</span></div>`;
    html += `<div class="group-items ${expanded?'':'hidden'}" id="ing-group-${catIdx}">`;
    allIngs.forEach(ing => {
      const sel = simState.selectedIngredients.includes(ing.name);
      html += `<div class="check-item ${sel?'selected':''}" onclick="toggleIngredient(this,'${esc(ing.name)}')">
        <div class="checkbox">${sel?'✓':''}</div>
        <div class="item-info"><div class="item-name">${esc(ing.name)}</div>${showDesc ? `<div class="item-desc">${esc(ing.description)}</div>` : ''}</div>
      </div>`;
    });
    html += '</div>';
  });
  container.innerHTML = html;
  updateIngChips();
}

function toggleGroup(id){
  const el = document.getElementById(id);
  el.classList.toggle('hidden');
  const arrow = document.getElementById(id.replace('group','arrow'));
  if(arrow) arrow.textContent = el.classList.contains('hidden') ? '▼' : '▲';
}

function toggleIngredient(el, name){
  const idx = simState.selectedIngredients.indexOf(name);
  if(idx >= 0) simState.selectedIngredients.splice(idx, 1);
  else simState.selectedIngredients.push(name);
  el.classList.toggle('selected');
  el.querySelector('.checkbox').textContent = el.classList.contains('selected') ? '✓' : '';
  updateIngChips();
}

function updateIngChips(){
  const chips = document.getElementById('ing-chips');
  if(!chips) return;
  chips.innerHTML = simState.selectedIngredients.map(n =>
    `<div class="chip">${esc(n)} <span class="remove" onclick="removeIngredient('${esc(n)}')">✕</span></div>`
  ).join('');
}

function removeIngredient(name){
  simState.selectedIngredients = simState.selectedIngredients.filter(n=>n!==name);
  if(simState.ingMode === 'written') updateWrittenChips();
  else buildIngredientGroups();
}

// ── PRODUCT SELECT ──
function goToProductSelect(){
  if(simState.ingMode === 'written' && simState.selectedIngredients.length === 0){
    const textInput = document.getElementById('ing-text-input');
    if(textInput && textInput.value.trim()){
      textInput.value.trim().split(/[,\n]+/).map(s=>s.trim()).filter(Boolean).forEach(name=>{
        if(!simState.selectedIngredients.includes(name)) simState.selectedIngredients.push(name);
      });
    }
  }
  if(simState.selectedIngredients.length === 0){ showToast('성분을 선택해주세요'); return; }
  document.getElementById('topbar-title').textContent = '제품 선택';
  simState.prodMode = 'name_desc';
  buildProductGroups();
  showScreen('screen-sim-product');
}

function setProdMode(mode){
  simState.prodMode = mode;
  document.querySelectorAll('#prod-mode-chips .btn-toggle').forEach(b=>b.classList.remove('active'));
  document.querySelector(`#prod-mode-chips .btn-toggle[data-mode="${mode}"]`).classList.add('active');
  buildProductGroups();
}

function buildProductGroups(){
  const container = document.getElementById('product-groups');
  const showDetail = simState.prodMode === 'name_desc';
  let html = `<div class="selected-chips" id="prod-chips"></div>`;
  html += `<div style="padding:8px 16px;font-size:13px;color:#6650A4;font-weight:600">선택 성분: ${simState.selectedIngredients.join(', ')}</div>`;

  OTC_CATEGORIES.forEach((cat, catIdx) => {
    const subs = cat.subCategories.filter(s => DRUG_DATA[s.id] && DRUG_DATA[s.id].products.length > 0);
    if(!subs.length) return;
    const allProds = [];
    const seen = new Set();
    subs.forEach(s => {
      DRUG_DATA[s.id].products.forEach(p => {
        if(!seen.has(p.name)){ seen.add(p.name); allProds.push(p); }
      });
    });
    if(!allProds.length) return;
    const expanded = cat.subCategories.some(s => s.id === simState.subId);
    html += `<div class="group-header" onclick="toggleGroup('prod-group-${catIdx}')">${cat.icon} ${cat.name} (${allProds.length}) <span id="prod-arrow-${catIdx}">${expanded?'▲':'▼'}</span></div>`;
    html += `<div class="group-items ${expanded?'':'hidden'}" id="prod-group-${catIdx}">`;
    allProds.forEach(p => {
      const sel = simState.selectedProducts.includes(p.name);
      if(showDetail){
        html += `<div class="check-item ${sel?'selected':''}" onclick="toggleProduct(this,'${esc(p.name)}')">
          <div class="checkbox">${sel?'✓':''}</div>
          <div class="item-info"><div class="item-name">${esc(p.name)}</div><div class="item-desc">${esc(p.ingredient)}</div></div>
          <div class="item-badge">${esc(p.form)}</div>
        </div>`;
      } else {
        html += `<div class="check-item ${sel?'selected':''}" onclick="toggleProduct(this,'${esc(p.name)}')">
          <div class="checkbox">${sel?'✓':''}</div>
          <div class="item-info"><div class="item-name">${esc(p.name)}</div></div>
        </div>`;
      }
    });
    html += '</div>';
  });
  container.innerHTML = html;
  updateProdChips();
}

function toggleProduct(el, name){
  const idx = simState.selectedProducts.indexOf(name);
  if(idx >= 0) simState.selectedProducts.splice(idx, 1);
  else simState.selectedProducts.push(name);
  el.classList.toggle('selected');
  el.querySelector('.checkbox').textContent = el.classList.contains('selected') ? '✓' : '';
  updateProdChips();
}

function updateProdChips(){
  const chips = document.getElementById('prod-chips');
  if(!chips) return;
  chips.innerHTML = simState.selectedProducts.map(n =>
    `<div class="chip">${esc(n)} <span class="remove" onclick="removeProduct('${esc(n)}')">✕</span></div>`
  ).join('');
}

function removeProduct(name){
  simState.selectedProducts = simState.selectedProducts.filter(n=>n!==name);
  buildProductGroups();
}

// ── COUNSELING ──
function goToCounseling(){
  if(simState.selectedProducts.length === 0){ showToast('제품을 선택해주세요'); return; }
  document.getElementById('topbar-title').textContent = '복약지도';
  simState.counselingMessages = [...simState.messages];
  const sysMsg = `💊 선택한 제품: ${simState.selectedProducts.join(', ')}\n이제 환자에게 복약지도를 해주세요. (용법, 주의사항, 부작용 등)`;
  simState.counselingMessages.push({role:'user', content: sysMsg});
  const chatArea = document.getElementById('counseling-messages');
  let html = '';
  simState.messages.forEach(m => {
    if(m.role==='assistant') html += `<div class="chat-msg patient">${esc(m.content)}</div>`;
    else if(m.role==='user') html += `<div class="chat-msg pharmacist">${esc(m.content)}</div>`;
  });
  html += `<div class="chat-msg system">${esc(sysMsg)}</div>`;
  chatArea.innerHTML = html;
  showScreen('screen-sim-counseling');
}

async function sendCounseling(){
  const input = document.getElementById('counseling-input');
  const msg = input.value.trim();
  if(!msg) return;
  input.value = '';
  const chatArea = document.getElementById('counseling-messages');
  chatArea.innerHTML += `<div class="chat-msg pharmacist">${esc(msg)}</div>`;
  simState.counselingMessages.push({role:'user', content:msg});
  chatArea.innerHTML += `<div class="chat-msg system">환자 응답 중<span class="loading-dots"></span></div>`;
  chatArea.scrollTop = chatArea.scrollHeight;

  const result = await callAPI('/api/chat', {
    apiKey: getApiKey(), model: getModel(),
    systemPrompt: simState.systemPrompt,
    messages: simState.counselingMessages
  });

  const loading = chatArea.querySelector('.chat-msg.system:last-child');
  if(loading && loading.textContent.includes('응답 중')) chatArea.removeChild(loading);

  if(result.error){ chatArea.innerHTML += `<div class="chat-msg system">오류: ${result.error}</div>`; return; }
  simState.counselingMessages.push({role:'assistant', content:result.content});
  chatArea.innerHTML += `<div class="chat-msg patient">${esc(result.content)}</div>`;
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ── EVALUATION ──
function getPatientLabel(){
  if(simState.patientType === 'comorbidity'){
    const c = COMORBIDITY_TYPES.find(t=>t.id===simState.comorbidityId);
    return '🏥 기저질환자 (' + (c ? c.label : '') + ')';
  }
  return PATIENT_TYPES.find(p=>p.id===simState.patientType)?.label || '일반 성인';
}

async function requestEvaluation(){
  document.getElementById('topbar-title').textContent = 'AI 평가';
  document.getElementById('eval-result').innerHTML = '<div class="loading">AI가 평가 중입니다<span class="loading-dots"></span></div>';
  document.getElementById('eval-qa-area').innerHTML = '';
  showScreen('screen-sim-eval');

  const drugs = DRUG_DATA[simState.subId];
  const ingDB = drugs ? drugs.ingredients.map(i=>`${i.name}: ${i.description}`).join('\n') : '';
  const prodDB = drugs ? drugs.products.map(p=>`${p.name}(${p.ingredient}/${p.form})`).join(', ') : '';
  const ptLabel = getPatientLabel();

  const chatLog = simState.counselingMessages
    .filter(m=>m.role!=='system')
    .map(m=> m.role==='user' ? `약사: ${m.content}` : `환자: ${m.content}`)
    .join('\n');

  const evalPrompt = `다음 약국 복약지도 상담을 평가해주세요. 반드시 아래 형식을 지켜 한국어로 작성하세요.

## 시나리오
카테고리: ${simState.subId}
환자 유형: ${ptLabel}

## 이 카테고리의 성분 DB
${ingDB}

## 이 카테고리의 제품 DB
${prodDB}

## 상담 내용
${chatLog}

## 약사의 선택
성분: ${simState.selectedIngredients.join(', ')}
제품: ${simState.selectedProducts.join(', ')}

## 출력 형식

🏆 한줄 평가
[10점 만점 점수]/10 — [한 문장 총평]

💡 모범답안
- 꼭 물어봤어야 할 핵심 질문 2~3개
- 적합한 성분: [구체적 성분명] — [이 환자에게 적합한 이유 1줄]
- 적합한 제품: [구체적 제품명(성분/제형)] — [이 환자에게 적합한 이유 1줄]
- 이 환자(${ptLabel})에게 부적합하거나 금기인 성분이 있다면 명시

📋 상세 평가
✅ 질문 적절성: (2~3줄)
💊 성분 선택: 약사가 고른 성분이 적합한지, 더 나은 대안은 무엇인지 (2~3줄)
📦 제품 선택: 약사가 고른 제품이 적합한지, 더 나은 대안은 무엇인지 (2~3줄)
💬 복약지도: 용법·용량, 주의사항, 부작용 안내가 충분했는지 (2~3줄)
🌟 개선점: (1~2줄)`;

  const result = await callAPI('/api/evaluate', {
    apiKey: getApiKey(), model: getModel(),
    systemPrompt: '당신은 약학 전문가이자 교육자입니다. 약국 복약지도 상담을 평가해주세요.',
    messages: [{role:'user', content:evalPrompt}]
  });

  if(result.error){
    document.getElementById('eval-result').innerHTML = `<div style="color:red;padding:20px">오류: ${result.error}</div>`;
  } else {
    simState.evaluation = result.content;
    document.getElementById('eval-result').innerHTML =
      `<div style="padding:4px 0;margin-bottom:12px;font-size:13px;color:#6650A4;font-weight:600">성분: ${simState.selectedIngredients.join(', ')} | 제품: ${simState.selectedProducts.join(', ')}</div>` +
      `<div style="white-space:pre-wrap;line-height:1.8">${esc(result.content)}</div>`;
    renderEvalQA();
  }
}

function renderEvalQA(){
  let html = '<div style="border-top:1px solid #eee;margin-top:16px;padding-top:16px">';
  html += '<div style="font-size:15px;font-weight:700;color:#6650A4;margin-bottom:12px">💬 추가 질문</div>';
  simState.evalQAs.forEach(qa=>{
    html += `<div class="chat-msg pharmacist" style="margin:8px 16px 8px auto">${esc(qa.question)}</div>`;
    html += `<div class="chat-msg patient" style="margin:8px auto 8px 0">${esc(qa.answer)}</div>`;
  });
  html += `<div style="display:flex;gap:8px;padding:8px 0">
    <textarea id="eval-qa-input" placeholder="평가에 대해 질문하세요..." rows="2" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:10px;font-size:14px;font-family:inherit;resize:none;outline:none"></textarea>
    <button onclick="sendEvalQuestion()" class="btn-primary" style="white-space:nowrap">질문</button>
  </div></div>`;
  document.getElementById('eval-qa-area').innerHTML = html;
}

async function sendEvalQuestion(){
  const input = document.getElementById('eval-qa-input');
  const question = input.value.trim();
  if(!question) return;
  input.value = '';

  simState.evalQAs.push({question, answer:'답변 생성 중...'});
  renderEvalQA();

  const messages = [
    {role:'user', content:`다음은 복약지도 시뮬레이션 평가 결과입니다:\n\n${simState.evaluation}\n\n학생의 질문: ${question}`}
  ];
  const result = await callAPI('/api/evaluate', {
    apiKey: getApiKey(), model: getModel(),
    systemPrompt: '당신은 약학 교육 전문가입니다. 학생의 복약지도 시뮬레이션 관련 질문에 답해주세요.',
    messages
  });

  const last = simState.evalQAs[simState.evalQAs.length - 1];
  last.answer = result.error ? `오류: ${result.error}` : result.content;
  renderEvalQA();
}

function resetSim(){
  simState = { subId:'', patientType:'', comorbidityId:'', messages:[], counselingMessages:[], selectedIngredients:[], selectedProducts:[], ingMode:'choice_desc', prodMode:'name_desc', evalQAs:[], evaluation:'' };
  switchMode('sim');
}

// ── API CALL ──
async function callAPI(endpoint, body){
  const { apiKey, model, messages, systemPrompt } = body;
  const isEval = endpoint.includes('evaluate');
  const userKey = apiKey || getApiKey();

  if(userKey){
    const msgs = [];
    if(systemPrompt) msgs.push({role:'system', content:systemPrompt});
    msgs.push(...messages);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {'Content-Type':'application/json', 'Authorization':'Bearer '+userKey},
        body: JSON.stringify({model: model||'gpt-4o-mini', messages:msgs, temperature: isEval?0.3:0.8, max_tokens: isEval?3000:2000})
      });
      const data = await res.json();
      if(data.error) return {error: data.error.message};
      return {content: data.choices[0].message.content};
    } catch(e){
      return {error: e.message};
    }
  } else {
    try {
      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({model: model||getModel(), messages, systemPrompt, mode: isEval?'evaluate':'chat'})
      });
      const data = await res.json();
      if(!res.ok || data.error) return {error: data.error || 'Server error'};
      return data;
    } catch(e){
      return {error: e.message};
    }
  }
}

// ── INIT ──
buildCategoryList();
