const API_URL = "https://script.google.com/macros/s/AKfycbwKFk7CfOfJ6kr2tOczkmqZtZvphj2GfAJWl3C-c-Qred37TxlvYV_owLZBSiSTuxVncg/exec";
let pendingSetupUsername = null;

const loginForm = document.getElementById('login-form');
const setupForm = document.getElementById('setup-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('login-btn');
const btnSetup = document.getElementById('setup-btn');

function toast(msg, isError = false) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = isError ? '#ff4a4a' : '#39d98a';
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3500);
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnLogin.disabled = true;
    btnLogin.textContent = 'Authenticating...';

    const payload = {
        action: 'auth',
        data: { username: usernameInput.value, password: passwordInput.value }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.error) throw new Error(result.error);
        
        if (result.requiresSetup) {
            pendingSetupUsername = result.username;
            loginForm.style.display = 'none';
            setupForm.style.display = 'block';
            toast('Account setup required.');
        } else if (result.ok) {
            localStorage.setItem('gf_token', result.token);
            localStorage.setItem('gf_user', JSON.stringify(result.user));
            window.location.href = './dashboard/index.html';
        }
    } catch (err) {
        toast(err.message, true);
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Secure Sign In';
    }
});

setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnSetup.disabled = true;
    btnSetup.textContent = 'Securing Account...';

    const newPassword = document.getElementById('new-password').value;

    const payload = {
        action: 'setupPassword',
        data: { username: pendingSetupUsername, password: newPassword }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.error) throw new Error(result.error);
        
        if (result.ok) {
            localStorage.setItem('gf_token', result.token);
            localStorage.setItem('gf_user', JSON.stringify(result.user));
            window.location.href = './dashboard/index.html';
        }
    } catch (err) {
        toast(err.message, true);
    } finally {
        btnSetup.disabled = false;
        btnSetup.textContent = 'Set Password & Login';
    }
});
