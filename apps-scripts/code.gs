function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    let result;

    if (action === 'auth') result = authenticate(payload.data);
    else if (action === 'setupPassword') result = setupPassword(payload.data);
    else if (action === 'addUser') result = manageUser(payload.token, payload.data, 'ADD');
    else if (action === 'removeUser') result = manageUser(payload.token, payload.data, 'REMOVE');
    else if (action === 'resetPassword') result = manageUser(payload.token, payload.data, 'RESET');
    else throw new Error("Unknown action");

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}

function getUsers_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('FAMILY_USERS_JSON');
  if (!raw) {
    const defaultUsers = [
      { id: 'gobinath', name: 'Gobinath', role: 'Owner', active: true, passwordHash: '' },
      { id: 'avadaipriya', name: 'Avadaipriya K.', role: 'Owner', active: true, passwordHash: '' }
    ];
    props.setProperty('FAMILY_USERS_JSON', JSON.stringify(defaultUsers));
    return defaultUsers;
  }
  return JSON.parse(raw);
}

function saveUsers_(users) {
  PropertiesService.getScriptProperties().setProperty('FAMILY_USERS_JSON', JSON.stringify(users));
}

function authenticate(data) {
  const username = String(data.username || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!username) throw new Error('Username is required.');

  const users = getUsers_();
  const user = users.find(u => u.id === username && u.active);
  if (!user) throw new Error('Invalid user account.');

  // Check for First-Time Login
  if (!user.passwordHash) {
    return { requiresSetup: true, username: user.id };
  }

  if (!password) throw new Error('Password is required.');
  const suppliedHash = sha256Hex_(password);
  
  if (user.passwordHash !== suppliedHash) throw new Error('Invalid password.');

  const tokenPayload = Utilities.base64EncodeWebSafe(JSON.stringify({ userId: user.id, issuedAt: Date.now() }));
  const token = tokenPayload + '.' + signToken_(tokenPayload);

  return { ok: true, token, user: { id: user.id, name: user.name, role: user.role } };
}

function setupPassword(data) {
  const username = String(data.username || '').trim().toLowerCase();
  const newPassword = String(data.password || '');
  if (!newPassword || newPassword.length < 6) throw new Error('Password must be at least 6 characters.');

  const users = getUsers_();
  const userIndex = users.findIndex(u => u.id === username && u.active);
  if (userIndex === -1) throw new Error('Invalid user account.');
  if (users[userIndex].passwordHash) throw new Error('Password already set.');

  users[userIndex].passwordHash = sha256Hex_(newPassword);
  saveUsers_(users);

  return authenticate({ username: username, password: newPassword });
}

function manageUser(token, data, action) {
  const session = authorize_(token);
  if (session.role !== 'Owner') throw new Error('Unauthorized. Owners only.');

  let users = getUsers_();
  const targetId = String(data.userId || '').trim().toLowerCase();

  if (action === 'ADD') {
    if (users.find(u => u.id === targetId)) throw new Error('User ID already exists.');
    users.push({ id: targetId, name: data.name, role: data.role || 'Member', active: true, passwordHash: '' });
  } 
  else if (action === 'REMOVE') {
    if (targetId === 'gobinath') throw new Error('Cannot remove primary owner.');
    users = users.filter(u => u.id !== targetId);
  } 
  else if (action === 'RESET') {
    const uIdx = users.findIndex(u => u.id === targetId);
    if (uIdx === -1) throw new Error('User not found.');
    users[uIdx].passwordHash = ''; // Clears password, triggering first-time setup on next login
  }
  
  saveUsers_(users);
  return { ok: true, users: users.map(u => ({ id: u.id, name: u.name, role: u.role })) };
}

function authorize_(token) {
  if (!token) throw new Error('Session expired.');
  const parts = String(token).split('.');
  if (parts.length !== 2 || signToken_(parts[0]) !== parts[1]) throw new Error('Invalid token');
  const decoded = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  
  // Enforce 10 Hour Session Limit
  const maxMs = getConfig_().sessionHours * 60 * 60 * 1000;
  if (!decoded.userId || !decoded.issuedAt || Date.now() - Number(decoded.issuedAt) > maxMs) throw new Error('Session expired.');
  
  const user = getUsers_().find(u => String(u.id) === String(decoded.userId) && u.active);
  if (!user) throw new Error('Inactive user');
  return { userId: user.id, role: user.role };
}

function signToken_(payload) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('TOKEN_SECRET');
  if (!secret) { secret = Utilities.getUuid(); props.setProperty('TOKEN_SECRET', secret); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret, Utilities.Charset.UTF_8));
}

function sha256Hex_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}
