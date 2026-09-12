/**
 * Gobinath Family Finance Enterprise backend.
 * Keeps the existing four-sheet workbook structure intact.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gobinath Family Finance Enterprise')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function bootstrap() {
  const cfg = getConfig_();
  const users = getUsers_().map(u => ({
    id: u.id,
    name: u.name,
    initials: initials_(u.name),
    role: u.role || 'Member',
    active: u.active !== false
  }));

  return {
    ok: true,
    appName: cfg.appName,
    currency: cfg.currency,
    users,
    categories: isSpreadsheetConfigured_() ? readCategories_() : [],
    backend: 'Google Apps Script',
    spreadsheetConfigured: isSpreadsheetConfigured_()
  };
}

function authenticate(payload) {
  const username = String(payload && payload.username || '').trim();
  const password = String(payload && payload.password || '');
  if (!username || !password) throw new Error('User and password are required.');

  const user = getUsers_().find(u => String(u.id).toLowerCase() === username.toLowerCase() && u.active !== false);
  if (!user) throw new Error('Invalid user or password.');

  const storedHash = String(user.passwordHash || '');
  if (!storedHash) throw new Error('User password has not been configured.');
  const suppliedHash = sha256Hex_(password + String(user.salt || ''));
  if (storedHash !== suppliedHash) throw new Error('Invalid user or password.');

  const tokenPayload = Utilities.base64EncodeWebSafe(JSON.stringify({
    userId: user.id,
    issuedAt: Date.now()
  }));
  const token = tokenPayload + '.' + signToken_(tokenPayload);

  return {
    ok: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role || 'Member',
      initials: initials_(user.name)
    }
  };
}

function getDashboard(token, filters) {
  authorize_(token);
  const tx = readTransactions_();
  const filtered = filterTransactions_(tx, filters || {});
  const income = filtered.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);

  return {
    ok: true,
    metrics: {
      income,
      expense,
      net: income - expense,
      transactions: filtered.length
    },
    recent: filtered.slice(0, getConfig_().maxRecentTransactions),
    categorySpend: aggregateExpenseCategories_(filtered),
    monthly: aggregateMonthly_(tx),
    settlements: readSettlements_()
  };
}

function addTransaction(token, payload) {
  const session = authorize_(token);
  const p = payload || {};
  const amount = Number(p.amount);
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');
  if (!['CREDIT', 'DEBIT'].includes(p.type)) throw new Error('Invalid transaction type.');
  if (!p.category) throw new Error('Category is required.');

  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.transactions);
  
  const record = [
    p.date || Utilities.formatDate(new Date(), getConfig_().timezone, 'yyyy-MM-dd'),
    p.type,
    p.category,
    p.description || '',
    session.userId,
    p.scope || 'Personal',
    amount,
    p.familySplit || '',
    p.notes || '',
    p.id || Utilities.getUuid()
  ];
  sh.appendRow(record);
  SpreadsheetApp.flush();

  return { ok: true, id: record[9], transaction: normalizeTransaction_(record) };
}

function editTransaction(token, payload) {
  authorize_(token);
  const p = payload || {};
  const amount = Number(p.amount);
  if (!p.id) throw new Error('Transaction ID missing.');
  if (!amount || amount <= 0) throw new Error('Amount must be greater than zero.');

  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.transactions);
  const data = sh.getDataRange().getValues();
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][9] === p.id) { rowIndex = i + 1; break; }
  }
  
  if (rowIndex === -1) throw new Error('Transaction not found in ledger.');

  const record = [
    p.date,
    p.type,
    p.category,
    p.description || '',
    p.user,
    p.scope || 'Personal',
    amount,
    p.familySplit || '',
    p.notes || '',
    p.id
  ];
  
  sh.getRange(rowIndex, 1, 1, 10).setValues([record]);
  SpreadsheetApp.flush();
  return { ok: true, id: p.id };
}

function deleteTransaction(token, id) {
  authorize_(token);
  if (!id) throw new Error('Transaction ID missing.');

  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.transactions);
  const data = sh.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][9] === id) {
      sh.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  throw new Error('Transaction not found.');
}

function addSettlement(token, payload) {
  const session = authorize_(token);
  const p = payload || {};
  const amount = Number(p.amount);
  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.settlement);
  
  sh.appendRow([
    p.date || Utilities.formatDate(new Date(), getConfig_().timezone, 'yyyy-MM-dd'),
    p.from || session.userId,
    p.to || '',
    amount,
    p.type || 'DUE',
    p.notes || ''
  ]);
  SpreadsheetApp.flush();
  return { ok: true };
}

function readCategories_() {
  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.categories);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues();
  return values.filter(r => r[2]).map(r => ({ type: r[1], category: r[2] }));
}

function readTransactions_() {
  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.transactions);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
  return values.map(normalizeTransaction_).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function normalizeTransaction_(r) {
  return {
    date: formatDateValue_(r[0]),
    type: String(r[1] || '').toUpperCase(),
    category: String(r[2] || ''),
    description: String(r[3] || ''),
    user: String(r[4] || ''),
    scope: String(r[5] || 'Personal'),
    amount: Number(r[6] || 0),
    familySplit: String(r[7] || ''),
    notes: String(r[8] || ''),
    id: String(r[9] || '')
  };
}

function readSettlements_() {
  const ss = openSpreadsheet_();
  const sh = ss.getSheetByName(getConfig_().sheets.settlement);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  return values.map(r => ({
    date: formatDateValue_(r[0]),
    from: String(r[1] || ''),
    to: String(r[2] || ''),
    amount: Number(r[3] || 0),
    type: String(r[4] || ''),
    notes: String(r[5] || '')
  }));
}

function filterTransactions_(tx, f) {
  const q = String(f.search || '').toLowerCase().trim();
  return tx.filter(t => {
    const qOk = !q || [t.category, t.description, t.user, t.notes, t.id].some(x => String(x).toLowerCase().includes(q));
    const typeOk = !f.type || f.type === 'ALL' || t.type === f.type;
    const scopeOk = !f.scope || f.scope === 'ALL' || t.scope === f.scope;
    const userOk = !f.user || f.user === 'ALL' || t.user === f.user;
    const fromOk = !f.from || t.date >= f.from;
    const toOk = !f.to || t.date <= f.to;
    return qOk && typeOk && scopeOk && userOk && fromOk && toOk;
  });
}

function aggregateExpenseCategories_(tx) {
  const map = {};
  tx.filter(t => t.type === 'DEBIT').forEach(t => map[t.category] = (map[t.category] || 0) + t.amount);
  return Object.keys(map).map(k => ({ category: k, amount: map[k] })).sort((a, b) => b.amount - a.amount);
}

function aggregateMonthly_(tx) {
  const map = {};
  tx.forEach(t => {
    const month = String(t.date || '').slice(0, 7);
    if (!month) return;
    if (!map[month]) map[month] = { month, income: 0, expense: 0 };
    if (t.type === 'CREDIT') map[month].income += t.amount;
    if (t.type === 'DEBIT') map[month].expense += t.amount;
  });
  return Object.keys(map).sort().slice(-12).map(k => map[k]);
}

function getUsers_() {
  const raw = PropertiesService.getScriptProperties().getProperty('FAMILY_USERS_JSON');
  if (!raw) return [
    { id: 'Gobinath', name: 'Gobinath', role: 'Owner', active: true, passwordHash: '', salt: '' },
    { id: 'Avadaipriya', name: 'Avadaipriya', role: 'Member', active: true, passwordHash: '', salt: '' }
  ];
  return JSON.parse(raw);
}

function authorize_(token) {
  if (!token) throw new Error('Session expired. Please sign in again.');
  try {
    const parts = String(token).split('.');
    if (parts.length !== 2 || signToken_(parts[0]) !== parts[1]) throw new Error('Invalid token');
    const decoded = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    const maxMs = getConfig_().sessionHours * 60 * 60 * 1000;
    if (!decoded.userId || !decoded.issuedAt || Date.now() - Number(decoded.issuedAt) > maxMs) throw new Error('Session expired.');
    return decoded;
  } catch (e) {
    throw new Error('Session expired. Please sign in again.');
  }
}

function signToken_(payload) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TOKEN_SECRET');
  if (!secret) { secret = Utilities.getUuid(); props.setProperty('TOKEN_SECRET', secret); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8));
}

function sha256Hex_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return digest.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function initials_(name) { return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
function formatDateValue_(value) { return value instanceof Date ? Utilities.formatDate(value, getConfig_().timezone, 'yyyy-MM-dd') : String(value || ''); }
function isSpreadsheetConfigured_() { return getConfig_().spreadsheetId && !String(getConfig_().spreadsheetId).includes('PASTE_GOOGLE_SHEET_ID'); }
function openSpreadsheet_() { return SpreadsheetApp.openById(getConfig_().spreadsheetId); }
