// profile.js — SCR-007: Профиль клиента (Картинг)

async function loadProfile() {
    const container = document.getElementById('tab-profile');
    container.innerHTML = renderSkeleton('profile');
    try {
        const client = await apiGet('/profile');
        renderProfile(client);
    } catch (err) {
        container.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить профиль.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="loadProfile()">Обновить</button></div>`;
    }
}

function renderProfile(client) {
    const container = document.getElementById('tab-profile');
    const phoneDisplay = client.phone ? client.phone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3-$4-$5') : '';
    container.innerHTML = `
        <h5 class="mb-3">Профиль</h5>
        <div class="card mb-3"><div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div><div class="text-secondary small">Имя</div><div id="display-name" class="fs-5">${client.name || 'Не указано'}</div></div>
                <button class="btn btn-outline-secondary btn-sm" onclick="editName()"><i class="bi bi-pencil"></i></button>
            </div>
            <div class="d-flex justify-content-between align-items-center">
                <div><div class="text-secondary small">Телефон</div><div id="display-phone" class="fs-5">${phoneDisplay}</div></div>
                <button class="btn btn-outline-secondary btn-sm" onclick="editPhone()"><i class="bi bi-pencil"></i></button>
            </div>
        </div></div>
        <div class="card mb-3"><div class="card-body p-3">
            <div class="mb-2"><a href="#" class="text-decoration-none text-dark" onclick="showSnackbar('Правила центра временно недоступны', 'info')">Правила центра ›</a></div>
            <div class="mb-2"><a href="#" class="text-decoration-none text-dark" onclick="showSnackbar('Поддержка временно недоступна', 'info')">Поддержка ›</a></div>
            <div class="text-secondary small">Версия приложения 1.0.0</div>
        </div></div>
        <button class="btn btn-outline-secondary w-100 mb-3" onclick="confirmLogout()">Выйти</button>
        <button class="btn btn-outline-danger w-100" onclick="confirmDeleteAccount()">Удалить аккаунт</button>
    `;
}

function editName() {
    const nameEl = document.getElementById('display-name');
    const currentName = nameEl.textContent === 'Не указано' ? '' : nameEl.textContent;
    nameEl.innerHTML = `<input type="text" id="edit-name-input" class="form-control form-control-sm" value="${currentName}" style="width:auto;display:inline-block;"> <button class="btn btn-sm btn-outline-primary" onclick="saveName()">✓</button>`;
    document.getElementById('edit-name-input').focus();
}
async function saveName() {
    const input = document.getElementById('edit-name-input');
    const newName = input.value.trim();
    if (!newName || newName.length > 100) { showSnackbar('Имя должно быть от 1 до 100 символов', 'error'); return; }
    try {
        await apiPatch('/profile', { name: newName });
        showSnackbar('Профиль обновлён', 'success');
        loadProfile();
    } catch (err) { showSnackbar(err.message || 'Не удалось обновить имя', 'error'); }
}

function editPhone() {
    const phoneEl = document.getElementById('display-phone');
    const currentPhone = phoneEl.textContent.replace(/[^\d+]/g, '');
    phoneEl.innerHTML = `<input type="tel" id="edit-phone-input" class="form-control form-control-sm" value="${currentPhone}" style="width:auto;display:inline-block;"> <button class="btn btn-sm btn-outline-primary" onclick="requestPhoneChangeCode()">✓</button>`;
    document.getElementById('edit-phone-input').focus();
}
async function requestPhoneChangeCode() {
    const input = document.getElementById('edit-phone-input');
    const newPhone = input.value.trim();
    if (!/^\+[1-9]\d{1,14}$/.test(newPhone)) { showSnackbar('Неверный формат телефона', 'error'); return; }
    try {
        await apiPost('/profile/phone/request-code', { new_phone: newPhone });
        showPhoneChangeOTP(newPhone);
    } catch (err) { showSnackbar(err.message || 'Не удалось запросить код', 'error'); }
}
function showPhoneChangeOTP(newPhone) {
    const container = document.getElementById('tab-profile');
    container.innerHTML = `
        <h5 class="mb-3">Подтверждение телефона</h5>
        <p>Мы отправили код на <strong>${newPhone}</strong></p>
        <input type="text" id="phone-change-otp" class="form-control text-center mb-2" placeholder="••••" maxlength="4" inputmode="numeric">
        <div class="error-message" id="phone-otp-error"></div>
        <button id="verify-phone-change-btn" class="btn btn-primary-custom w-100 mt-2" disabled onclick="confirmPhoneChange('${newPhone}')">Подтвердить</button>
        <div class="text-center mt-2"><a href="#" id="resend-phone-link" class="text-secondary disabled" style="pointer-events:none;">Отправить код повторно (0:30)</a></div>
        <button class="btn btn-outline-secondary w-100 mt-2" onclick="loadProfile()">Отмена</button>
    `;
    const otpInput = document.getElementById('phone-change-otp');
    const verifyBtn = document.getElementById('verify-phone-change-btn');
    otpInput.addEventListener('input', () => {
        const val = otpInput.value.replace(/\D/g, '').slice(0, 4);
        otpInput.value = val;
        verifyBtn.disabled = val.length !== 4;
    });
    startPhoneResendTimer(newPhone);
}
function startPhoneResendTimer(phone) {
    let remaining = 30;
    const link = document.getElementById('resend-phone-link');
    link.classList.add('disabled'); link.style.pointerEvents = 'none';
    link.textContent = `Отправить код повторно (0:${remaining.toString().padStart(2,'0')})`;
    const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(timer);
            link.classList.remove('disabled'); link.style.pointerEvents = 'auto';
            link.textContent = 'Отправить код повторно';
            link.onclick = (e) => { e.preventDefault(); if (!link.classList.contains('disabled')) requestPhoneChangeCode(phone); };
        } else {
            link.textContent = `Отправить код повторно (0:${remaining.toString().padStart(2,'0')})`;
        }
    }, 1000);
    link.onclick = (e) => e.preventDefault();
}
async function confirmPhoneChange(newPhone) {
    const code = document.getElementById('phone-change-otp').value.trim();
    if (code.length !== 4) return;
    const btn = document.getElementById('verify-phone-change-btn');
    btn.disabled = true; btn.textContent = 'Проверка...';
    try {
        await apiPost('/profile/phone/confirm', { new_phone: newPhone, code });
        showSnackbar('Изменения сохранены', 'success');
        loadProfile();
    } catch (err) {
        document.getElementById('phone-otp-error').textContent = err.message || 'Код неверен';
        btn.disabled = false; btn.textContent = 'Подтвердить';
    }
}

function confirmLogout() {
    const modal = document.getElementById('logout-modal');
    if (!modal) {
        const modalHtml = `<div class="modal fade" id="logout-modal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Выйти из аккаунта?</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">Чтобы снова записаться на заезд, нужно будет войти по номеру телефона.</div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Отмена</button><button type="button" class="btn btn-danger" id="confirm-logout-btn">Выйти</button></div></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    new bootstrap.Modal(document.getElementById('logout-modal')).show();
    document.getElementById('confirm-logout-btn').onclick = executeLogout;
}
async function executeLogout() {
    try { await apiPost('/auth/logout'); } catch (e) {}
    localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token');
    setTokens(null, null);
    const modalEl = document.getElementById('logout-modal');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    showScreen('login'); renderLogin();
}

function confirmDeleteAccount() {
    const modal = document.getElementById('delete-modal');
    if (!modal) {
        const modalHtml = `<div class="modal fade" id="delete-modal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Удалить аккаунт?</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">Ваши данные и брони будут удалены безвозвратно. Активные брони отменятся и освободят места. Это действие нельзя отменить.</div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Отмена</button><button type="button" class="btn btn-danger" id="confirm-delete-btn">Удалить аккаунт</button></div></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    new bootstrap.Modal(document.getElementById('delete-modal')).show();
    document.getElementById('confirm-delete-btn').onclick = executeDeleteAccount;
}
async function executeDeleteAccount() {
    try { await apiDelete('/profile'); } catch (e) { showSnackbar('Не удалось удалить аккаунт', 'error'); return; }
    localStorage.removeItem('access_token'); localStorage.removeItem('refresh_token');
    setTokens(null, null);
    const modalEl = document.getElementById('delete-modal');
    if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    showScreen('login'); renderLogin();
    showSnackbar('Аккаунт удалён', 'success');
}