const BASE_URL = '/api';
let sessionTokens = {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token')
};
function setTokens(access, refresh) {
    sessionTokens.access = access;
    sessionTokens.refresh = refresh;
    if (access) {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh || access);
    } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }
}
let isRefreshing = false;
let failedQueue = [];
async function refreshToken() {
    if (!sessionTokens.refresh) throw new Error('No refresh token');
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: sessionTokens.refresh })
    });
    if (!response.ok) { setTokens(null, null); throw new Error('Refresh failed'); }
    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
}
async function apiRequest(method, path, body = null, customHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionTokens.access}`,
        ...customHeaders
    };
    let response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (response.status === 401) {
        if (isRefreshing) {
            return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); });
        }
        isRefreshing = true;
        try {
            await refreshToken();
            headers['Authorization'] = `Bearer ${sessionTokens.access}`;
            response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
            failedQueue.forEach(p => p.resolve());
        } catch (err) {
            failedQueue.forEach(p => p.reject(err));
            setTokens(null, null);
            if (window.showScreen) { window.showScreen('login'); window.renderLogin(); }
            throw err;
        } finally { isRefreshing = false; failedQueue = []; }
    }
    if (!response.ok) {
        const err = await response.json().catch(() => ({ code: 'internal_error', message: 'Ошибка сервера' }));
        throw err;
    }
    if (response.status === 204) return null;
    return response.json();
}
const apiGet = (path) => apiRequest('GET', path);
const apiPost = (path, body, headers) => apiRequest('POST', path, body, headers);
const apiPatch = (path, body) => apiRequest('PATCH', path, body);
const apiDelete = (path) => apiRequest('DELETE', path);