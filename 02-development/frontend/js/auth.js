function renderLogin() {
    const loginScreen = document.getElementById('screen-login');
    loginScreen.innerHTML = `
        <div class="text-center mb-4"><h2 style="color:#d32f2f;">Апекс Картинг</h2><p class="text-secondary">Войдите, чтобы записаться на заезд</p></div>
        <div class="mb-3"><label class="form-label">Телефон</label><input type="tel" id="phone" class="form-control" placeholder="+79991234567" inputmode="tel"><div class="error-message" id="phone-error"></div></div>
        <button id="get-code-btn" class="btn btn-primary-custom w-100" disabled>Получить код</button>
        <p class="text-muted mt-2" style="font-size:14px;">Без пароля — входим по номеру телефона</p>
        <div id="otp-step" style="display:none;"><hr class="my-4"><p class="text-center">Мы отправили код на <strong id="phone-display"></strong></p><input type="text" id="otp-code" class="form-control text-center" placeholder="••••" maxlength="4" inputmode="numeric"><div class="error-message" id="otp-error"></div><button id="verify-code-btn" class="btn btn-primary-custom w-100 mt-3" disabled>Подтвердить</button><div class="text-center mt-2"><a href="#" id="resend-link" class="text-secondary disabled" style="pointer-events:none;">Отправить код повторно (0:30)</a></div></div>
        <div id="name-step" style="display:none;"><hr class="my-4"><label class="form-label">Как вас зовут?</label><input type="text" id="name" class="form-control" placeholder="Имя"><div class="error-message" id="name-error"></div><button id="continue-btn" class="btn btn-primary-custom w-100 mt-3" disabled>Продолжить</button></div>
    `;
    const phoneInput = document.getElementById('phone'), getCodeBtn = document.getElementById('get-code-btn');
    const phoneError = document.getElementById('phone-error'), otpStep = document.getElementById('otp-step');
    const otpInput = document.getElementById('otp-code'), verifyBtn = document.getElementById('verify-code-btn');
    const otpError = document.getElementById('otp-error'), resendLink = document.getElementById('resend-link');
    const nameStep = document.getElementById('name-step'), nameInput = document.getElementById('name');
    const continueBtn = document.getElementById('continue-btn'), nameError = document.getElementById('name-error');
    const phoneDisplay = document.getElementById('phone-display');
    let resendTimer = null;

    phoneInput.addEventListener('input', () => {
        getCodeBtn.disabled = !/^\+[1-9]\d{1,14}$/.test(phoneInput.value.trim());
        phoneError.textContent = '';
    });
    getCodeBtn.addEventListener('click', async () => {
        const phone = phoneInput.value.trim();
        if (!/^\+[1-9]\d{1,14}$/.test(phone)) { phoneError.textContent = 'Похоже, номер введён не полностью'; return; }
        getCodeBtn.disabled = true; getCodeBtn.textContent = 'Отправка...';
        try {
            await apiPost('/auth/request-code', { phone });
            state.phone = phone; phoneDisplay.textContent = phone;
            otpStep.style.display = 'block'; startResendTimer(30);
        } catch (err) { phoneError.textContent = err.message || 'Не удалось войти'; getCodeBtn.disabled = false; }
        getCodeBtn.textContent = 'Получить код';
    });
    function startResendTimer(seconds) {
        clearInterval(resendTimer); let remaining = seconds;
        resendLink.classList.add('disabled'); resendLink.style.pointerEvents = 'none';
        resendLink.textContent = `Отправить код повторно (0:${remaining.toString().padStart(2,'0')})`;
        resendTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) { clearInterval(resendTimer); resendLink.classList.remove('disabled'); resendLink.style.pointerEvents = 'auto'; resendLink.textContent = 'Отправить код повторно'; }
            else { resendLink.textContent = `Отправить код повторно (0:${remaining.toString().padStart(2,'0')})`; }
        }, 1000);
    }
    resendLink.addEventListener('click', (e) => { e.preventDefault(); if (!resendLink.classList.contains('disabled')) getCodeBtn.click(); });
    otpInput.addEventListener('input', () => {
        const val = otpInput.value.replace(/\D/g, '').slice(0,4);
        otpInput.value = val; verifyBtn.disabled = val.length !== 4; otpError.textContent = '';
    });
    verifyBtn.addEventListener('click', async () => {
        const code = otpInput.value.trim();
        if (code.length !== 4) return;
        verifyBtn.disabled = true; verifyBtn.textContent = 'Проверка...';
        try {
            const data = await apiPost('/auth/verify-code', { phone: state.phone, code });
            setTokens(data.tokens.access_token, data.tokens.refresh_token);
            if (data.is_new) { nameStep.style.display = 'block'; }
            else { showScreen('main'); switchTab('slots'); loadSlots(); }
        } catch (err) { otpError.textContent = err.message || 'Код неверен'; verifyBtn.disabled = false; }
        verifyBtn.textContent = 'Подтвердить';
    });
    nameInput.addEventListener('input', () => {
        const val = nameInput.value.trim();
        continueBtn.disabled = val.length < 1 || val.length > 100; nameError.textContent = '';
    });
    continueBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) return;
        continueBtn.disabled = true; continueBtn.textContent = 'Сохранение...';
        try {
            await apiPatch('/profile', { name });
            showScreen('main'); switchTab('slots'); loadSlots();
        } catch (err) { nameError.textContent = err.message || 'Проверьте имя'; continueBtn.disabled = false; }
        continueBtn.textContent = 'Продолжить';
    });
}