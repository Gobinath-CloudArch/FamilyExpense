<script>
const state={view:'dashboard',token:null,user:null,boot:null,data:null,filters:{search:'',type:'ALL',scope:'ALL',user:'ALL',from:'',to:''}};
const MOCK={users:[{id:'Gobinath',name:'Gobinath',role:'Owner',initials:'G'},{id:'Avadaipriya',name:'Avadaipriya',role:'Member',initials:'A'}],categories:[
{type:'Income',category:'Salary'},{type:'Income',category:'Bonus'},{type:'Expense',category:'Groceries'},{type:'Expense',category:'Household'},{type:'Expense',category:'Electricity'},{type:'Expense',category:'Water'},{type:'Expense',category:'School / Education'},{type:'Expense',category:'Vehicle Maintenance'},{type:'Expense',category:'Fuel'},{type:'Expense',category:'Dining'},{type:'Expense',category:'Shopping'},{type:'Expense',category:'Medical'}]};

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function money(v){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(v||0));}
function toast(msg,error=false){const e=document.createElement('div');e.className='toast'+(error?' error':'');e.textContent=msg;$('#toast-root').appendChild(e);setTimeout(()=>e.remove(),3200)}
function googleCall(name,args=[]){return new Promise((resolve,reject)=>{if(!(window.google && window.google.script && window.google.script.run)){reject(new Error('Apps Script runtime not found'));return}google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[name](...args)})}

async function boot(){try{state.boot=await googleCall('bootstrap');state.boot.demo=!state.boot.spreadsheetConfigured}catch(e){state.boot={...MOCK,demo:true,appName:'Gobinath Family Finance Enterprise'}}renderLogin();}

function renderLogin(error=''){
  document.body.innerHTML=`<div class="page login-wrap"><div class="login-card glass"><div class="brand-icon">G</div><div class="brand-title">Gobinath Family <span>Finance Enterprise</span></div>
  <form id="login-form" class="form-grid"><div class="field"><label>User</label><select class="filter" id="login-user" style="width:100%; height:54px">${(state.boot?.users||MOCK.users).map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select></div>
  <div class="field"><label>Password</label><input class="filter" id="login-pass" type="password" style="width:100%; height:54px"></div>
  ${error?`<div style="color:#ff8b98;font-size:12px">${esc(error)}</div>`:''}<button class="primary" id="login-btn">Sign in</button></form></div></div>`;
  $('#login-form').onsubmit=async e=>{e.preventDefault();const btn=$('#login-btn');btn.disabled=true;btn.textContent='Signing in…';const username=$('#login-user').value,password=$('#login-pass').value;try{let r;if(state.boot?.demo){r={ok:true,token:'demo',user:state.boot.users.find(x=>x.id===username)}}else{r=await googleCall('authenticate',[{username,password}])}state.token=r.token;state.user=r.user;await loadDashboard();}catch(err){renderLogin(err.message||'Unable to sign in.')}finally{if($('#login-btn')){btn.disabled=false;btn.textContent='Sign in'}}};
}

function demoDashboard(){const fmt=d=>new Date(d).toISOString().slice(0,10);return {metrics:{income:68000,expense:29460,net:38540,transactions:12},recent:[{date:fmt(new Date()),type:'DEBIT',category:'Groceries',description:'Weekly groceries',user:'Gobinath',scope:'Family',amount:3260,id:'1',familySplit:'Gobinath: 1630 | Avadaipriya: 1630'}],categorySpend:[],monthly:[],settlements:[]}}
async function loadDashboard(){try{state.data=state.boot?.demo?demoDashboard():await googleCall('getDashboard',[state.token,state.filters]);renderApp()}catch(e){toast(e.message,true);renderLogin('Session expired')}}

function renderApp(){document.body.innerHTML=`<div class="page"><div class="app-shell"><aside class="sidebar glass"><div class="side-brand"><div class="mini">G</div><div class="txt"><strong>Family Finance</strong></div></div><nav class="nav"><button class="active" data-view="dashboard">⌂<span>Overview</span></button><button data-view="transactions">▤<span>Transactions</span></button><button data-view="settlement">⇄<span>Settlement</span></button></nav></aside><main class="main"><div class="topbar"><div class="topbar-left"><h2>Ledger Control Center</h2></div><div class="top-actions"><button class="icon-btn" id="refresh">↻</button></div></div><div id="view-root"></div></main></div></div><div id="modal-root"></div>`;bindNav();renderView('dashboard');$('#refresh').onclick=loadDashboard;}
function bindNav(){document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderView(b.dataset.view)})}
function renderView(view){state.view=view;const r=$('#view-root');if(view==='dashboard')r.innerHTML=dashboardHtml();if(view==='transactions')r.innerHTML=transactionsHtml();if(view==='settlement')r.innerHTML=settlementHtml();}

function dashboardHtml(){const m=state.data?.metrics||{};return `<section class="hero glass"><div class="hero-left"><h1>Know where the money is going.</h1><div class="hero-actions"><button class="btn primary-sm" onclick="openTx('DEBIT')">+ Add expense</button><button class="btn" onclick="openTx('CREDIT')">+ Add income</button></div></div><div class="hero-side"><div class="balance">${money(m.net)}</div></div></section><section class="content-grid"><div class="panel glass" style="grid-column: 1 / -1"><div class="panel-head"><div class="panel-title">Recent transactions</div><button class="btn" onclick="renderView('transactions')">View all</button></div>${txTable(state.data?.recent||[])}</div></section>`}

// Modified Table injection to support action items[cite: 6]
function txTable(items){if(!items.length)return '<div class="empty">No transactions found.</div>';return `<div class="transactions"><table class="tx-table"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>User</th><th>Scope</th><th>Amount</th><th>Actions</th></tr></thead><tbody>${items.map(t=>`<tr><td>${esc(t.date)}</td><td><span class="type-pill ${t.type==='CREDIT'?'credit':'debit'}">${t.type}</span></td><td>${esc(t.category)}</td><td>${esc(t.description||'-')}</td><td>${esc(t.user)}</td><td><span class="scope-pill">${esc(t.scope)}</span></td><td class="amount ${t.type==='CREDIT'?'credit-text':'debit-text'}">${t.type==='CREDIT'?'+':'-'} ${money(t.amount)}</td><td><button class="action-btn edit-btn" onclick="window.editTx('${t.id}')">✎</button> <button class="action-btn del-btn" onclick="window.deleteTx('${t.id}')">🗑</button></td></tr>`).join('')}</tbody></table></div>`}

function transactionsHtml(){return `<section class="panel glass"><div class="panel-head"><div class="panel-title">Transaction ledger</div><div class="filters"><button class="btn primary-sm" onclick="openTx()">+ Add transaction</button></div></div>${txTable(state.data?.recent||[])}</section>`}
function settlementHtml(){const rows=state.data?.settlements||[];return `<section class="panel glass"><div class="panel-head"><div class="panel-title">Family settlement ledger</div></div>${rows.length?`<div class="transactions"><table class="tx-table"><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.from)} → ${esc(r.to)}</td><td>${money(r.amount)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No settlement records are present.</div>'}</section>`}
function categoryOptions(type){return (state.boot?.categories||MOCK.categories).filter(x=>x.type===(type==='CREDIT'?'Income':'Expense')).map(x=>`<option>${esc(x.category)}</option>`).join('')}

// Re-engineered Add/Edit Modal with dynamic Splitwise validation
function openTx(type='DEBIT', editObj=null){
  const t = editObj || { date: new Date().toISOString().slice(0,10), type: type, amount: '', scope: 'Personal', description: '', notes: '', familySplit: '' };
  
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop show" id="modal"><div class="modal glass"><div class="modal-head"><h3>${editObj ? 'Edit' : 'Add'} transaction</h3><button class="close" onclick="closeModal()">×</button></div>
  <form id="tx-form" class="form-2" data-id="${t.id||''}">
    <div class="field"><label>Date</label><input class="filter" style="width:100%;height:46px" id="tx-date" type="date" value="${t.date}"></div>
    <div class="field"><label>Type</label><select class="filter" style="width:100%;height:46px" id="tx-type"><option value="DEBIT" ${t.type==='DEBIT'?'selected':''}>Expense</option><option value="CREDIT" ${t.type==='CREDIT'?'selected':''}>Income</option></select></div>
    <div class="field"><label>Category</label><select class="filter" style="width:100%;height:46px" id="tx-category">${categoryOptions(t.type)}</select></div>
    <div class="field"><label>Amount (₹)</label><input type="number" step="0.01" class="filter" style="width:100%;height:46px" id="tx-amount" value="${t.amount||''}" required></div>
    <div class="field"><label>Scope</label><select class="filter" style="width:100%;height:46px" id="tx-scope"><option value="Family" ${t.scope==='Family'?'selected':''}>Family (Shared)</option><option value="Personal" ${t.scope==='Personal'?'selected':''}>Personal</option></select></div>
    <div class="field"><label>User</label><select class="filter" style="width:100%;height:46px" id="tx-user">${(state.boot?.users||MOCK.users).map(u=>`<option value="${esc(u.id)}" ${u.id===(t.user||state.user?.id)?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>
    <div class="field wide"><label>Description</label><input class="filter" style="width:100%;height:46px" id="tx-desc" value="${esc(t.description)}" placeholder="Optional notes"></div>
    
    <!-- Dynamic Splitwise Editor Block -->
    <div class="field wide" id="split-editor-wrap" style="display:none; background:#0b183266; border:1px solid #243b67; padding:16px; border-radius:12px;">
      <label style="color:#635bff">Family Split Validation</label>
      <div id="split-rows-container"></div>
      <div style="display:flex; justify-content:space-between; margin-top:14px; padding-top:14px; border-top:1px dashed #314a74">
        <span style="font-size:12px; color:#8295b9">Total Allocation Check</span>
        <div style="text-align:right">
          <strong id="split-total-display" style="color:#fff">0 / 0</strong>
          <div id="split-error" style="color:var(--red); font-size:11px; margin-top:4px; display:none;">Amounts must exactly match transaction total.</div>
        </div>
      </div>
    </div>
    
    <div class="wide"><button class="primary" id="tx-save">${editObj ? 'Update' : 'Save'} transaction</button></div>
  </form></div></div>`);
  
  if(t.category) { $('#tx-category').value = t.category; }
  
  $('#tx-type').onchange = e => { $('#tx-category').innerHTML = categoryOptions(e.target.value); };
  $('#tx-scope').onchange = validateSplitEditor;
  $('#tx-amount').oninput = validateSplitEditor;
  $('#tx-form').onsubmit = saveTx;
  
  // Inject Split UI values initially
  $('#tx-scope').dataset.initSplit = t.familySplit || '';
  validateSplitEditor();
}

// Splitwise verification logic injected directly onto the DOM
function validateSplitEditor() {
  const scope = $('#tx-scope').value;
  const wrap = $('#split-editor-wrap');
  const container = $('#split-rows-container');
  const total = Number($('#tx-amount').value || 0);
  
  if(scope !== 'Family') {
    wrap.style.display = 'none';
    $('#tx-save').disabled = false;
    return;
  }
  
  wrap.style.display = 'block';
  
  // Initialize inputs if empty
  if(container.innerHTML === '') {
    const users = state.boot?.users || MOCK.users;
    const existingStr = $('#tx-scope').dataset.initSplit;
    let prefill = {};
    if(existingStr) {
       existingStr.split('|').forEach(s => { const [n,v] = s.split(':'); if(n && v) prefill[n.trim()] = Number(v.trim()); });
    } else {
       users.forEach(u => prefill[u.name] = (total / users.length).toFixed(2));
    }
    
    container.innerHTML = users.map(u => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        <span style="font-size:13px">${esc(u.name)}</span>
        <input type="number" step="0.01" class="filter split-input" data-user="${esc(u.name)}" value="${prefill[u.name]||0}" style="width:120px; text-align:right;" oninput="recalcSplitTotal()">
      </div>
    `).join('');
  }
  recalcSplitTotal();
}

function recalcSplitTotal() {
  const total = Number($('#tx-amount').value || 0);
  let currentSplit = 0;
  document.querySelectorAll('.split-input').forEach(el => { currentSplit += Number(el.value || 0); });
  
  $('#split-total-display').textContent = `₹${currentSplit.toFixed(2)} / ₹${total.toFixed(2)}`;
  
  const diff = Math.abs(total - currentSplit);
  if(diff > 0.01 && total > 0) {
    $('#split-error').style.display = 'block';
    $('#tx-save').disabled = true;
  } else {
    $('#split-error').style.display = 'none';
    $('#tx-save').disabled = false;
  }
}

async function saveTx(e){
  e.preventDefault();
  
  // Format split back to text logic for the backend schema
  let formattedSplit = "";
  if($('#tx-scope').value === 'Family') {
    const arr = [];
    document.querySelectorAll('.split-input').forEach(el => arr.push(`${el.dataset.user}: ${el.value}`));
    formattedSplit = arr.join(' | ');
  }

  const payload = {
    id: $('#tx-form').dataset.id || null,
    date: $('#tx-date').value,
    type: $('#tx-type').value,
    category: $('#tx-category').value,
    amount: Number($('#tx-amount').value),
    scope: $('#tx-scope').value,
    user: $('#tx-user').value,
    description: $('#tx-desc').value,
    familySplit: formattedSplit
  };
  
  const btn = $('#tx-save'); btn.disabled = true; btn.textContent = 'Saving…';
  
  try{
    if(state.boot?.demo) { toast('Demo saved.'); }
    else if(payload.id) { await googleCall('editTransaction',[state.token, payload]); toast('Transaction updated.'); }
    else { await googleCall('addTransaction',[state.token, payload]); toast('Transaction saved.'); }
    
    closeModal(); await loadDashboard();
  }catch(err){ toast(err.message, true); btn.disabled = false; btn.textContent = 'Save transaction'; }
}

window.editTx = function(id) {
  const t = (state.data?.recent || []).find(x => x.id === id);
  if(!t) return toast('Item not found in current view.', true);
  openTx(t.type, t);
};

window.deleteTx = async function(id) {
  if(!confirm('Are you sure you want to delete this transaction from the ledger?')) return;
  try {
    if(!state.boot?.demo) await googleCall('deleteTransaction', [state.token, id]);
    toast('Transaction removed.');
    await loadDashboard();
  } catch (err) { toast(err.message, true); }
};

function closeModal(){const m=$('#modal');if(m)m.remove()}
boot();
</script>
