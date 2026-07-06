// booking.js — SCR-003, SCR-004, BS-002, SCR-006, BS-003, BS-004 (Картинг)

// ---------- SCR-003: Карточка заезда ----------
async function openSlot(slotId) {
    showScreen('slot-card');
    let screen = document.getElementById('screen-slot-card');
    if (!screen) {
        const screenHtml = `
        <div id="screen-slot-card" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToSlots()">← Назад</button>
                <h5 class="m-0">Заезд</h5>
            </div>
            <div id="slot-card-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-slot-card');
    screen.classList.add('active');
    const content = document.getElementById('slot-card-content');
    content.innerHTML = renderSkeleton('text', 6);
    try {
        const slot = await apiGet(`/slots/${slotId}`);
        renderSlotCard(slot);
    } catch (err) {
        content.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="openSlot('${slotId}')">Обновить</button></div>`;
    }
}
// ✅ ИСПРАВЛЕНО: экспортируем в глобальную область
window.openSlot = openSlot;

function goBackToSlots() {
    const screen = document.getElementById('screen-slot-card');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('slots');
}
window.goBackToSlots = goBackToSlots;

function renderSlotCard(slot) {
    const content = document.getElementById('slot-card-content');
    const freeText = slot.free_karts > 0 ? `Свободно ${slot.free_karts} из ${slot.total_karts}` : 'Мест нет';
    const helmetText = slot.free_helmets > 0 ? `Свободно шлемов: ${slot.free_helmets}` : 'Шлемов напрокат нет';
    const bookDisabled = slot.free_karts === 0 ? 'disabled' : '';
    const bookText = slot.free_karts > 0 ? 'Записаться' : 'Мест нет';
    const safeAddress = slot.center_address.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    let mapPreviewHtml = '';
    if (slot.center_lat && slot.center_lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${slot.center_lng},${slot.center_lat}&size=450,200&z=15&l=map&pt=${slot.center_lng},${slot.center_lat},pm2rdm`;
        mapPreviewHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта" onclick="showStudioAddress('${safeAddress}', ${slot.center_lat}, ${slot.center_lng})" style="cursor:pointer;">`;
    }

    const trackTypeLabel = slot.track_type === 'novice' ? 'Новичковая' : 'Опытная';

    content.innerHTML = `
        <div class="mb-3"><strong>${formatDateTime(slot.start_at)}</strong></div>
        <div class="card mb-2"><div class="card-body p-3">
            <h5>${slot.track_name}</h5>
            <span class="badge bg-secondary">${trackTypeLabel}</span>
            ${slot.track_description ? `<p class="mt-2 text-secondary">${slot.track_description}</p>` : ''}
            ${slot.track_duration ? `<p class="text-secondary">Длительность: ${slot.track_duration} мин</p>` : ''}
        </div></div>
        <div class="card mb-2"><div class="card-body p-3"><strong>Маршал:</strong> ${slot.marshal_name}</div></div>
        ${mapPreviewHtml}
        <div class="card mb-2" onclick="showStudioAddress('${safeAddress}', ${slot.center_lat || null}, ${slot.center_lng || null})" style="cursor:pointer;">
            <div class="card-body p-3"><strong>Адрес:</strong> ${slot.center_address}</div>
        </div>
        <div class="card mb-2"><div class="card-body p-3">
            <div><strong>Карты:</strong> ${freeText}</div>
            <div><strong>Шлемы:</strong> ${helmetText}</div>
        </div></div>
        <div class="card mb-2"><div class="card-body p-3">
            <div class="fs-5"><strong>${slot.price} ₽</strong> за место</div>
            <div class="text-muted">Оплата на месте: наличные или перевод</div>
        </div></div>
        <button class="btn btn-primary-custom w-100 mt-3" ${bookDisabled} onclick="startBooking('${slot.id}')">${bookText}</button>
    `;
}

// ---------- SCR-004: Оформление брони ----------
let currentBooking = {
    slotId: null,
    karts: 1,
    equipment: [],
    restrictions: '',
    idempotencyKey: null
};

async function startBooking(slotId) {
    let slot;
    try {
        slot = await apiGet(`/slots/${slotId}`);
    } catch (err) {
        showSnackbar('Не удалось загрузить данные заезда', 'error');
        return;
    }
    currentBooking.slotId = slotId;
    currentBooking.karts = 1;
    currentBooking.equipment = [];
    const defaultEquip = slot.free_helmets > 0 ? 'rental' : 'own';
    currentBooking.equipment.push(defaultEquip);
    currentBooking.restrictions = '';
    currentBooking.idempotencyKey = null;

    showScreen('booking-form');
    let screen = document.getElementById('screen-booking-form');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-form" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToSlotCard()">← Назад</button>
                <h5 class="m-0">Оформление заезда</h5>
            </div>
            <div id="booking-form-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-form');
    screen.classList.add('active');
    renderBookingForm(slot);
}
window.startBooking = startBooking;

function goBackToSlotCard() {
    const screen = document.getElementById('screen-booking-form');
    if (screen) screen.classList.remove('active');
    openSlot(currentBooking.slotId);
}
window.goBackToSlotCard = goBackToSlotCard;

function renderBookingForm(slot) {
    const maxKarts = Math.min(slot.free_karts, slot.track_capacity_cap || 14, 4);
    const helmetsAvailable = slot.free_helmets;
    const pricePerKart = slot.price;
    const helmetPrice = slot.rental_price;

    function recalcPrice() {
        let total = pricePerKart * currentBooking.karts;
        const rentalCount = currentBooking.equipment.filter(e => e === 'rental').length;
        total += helmetPrice * rentalCount;
        document.getElementById('price-total').textContent = `${total} ₽`;
        document.getElementById('cta-book').textContent = `Записаться · ${total} ₽`;
        const kartsValid = currentBooking.karts <= maxKarts;
        const helmetsValid = rentalCount <= helmetsAvailable;
        document.getElementById('cta-book').disabled = !(kartsValid && helmetsValid);
    }

    function renderEquipmentRows() {
        const container = document.getElementById('equipment-rows');
        let html = '';
        for (let i = 0; i < currentBooking.karts; i++) {
            const label = i === 0 ? 'Вы' : `Гость ${i}`;
            const isRental = currentBooking.equipment[i] === 'rental';
            html += `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span>Место ${i+1} (${label})</span>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-secondary ${!isRental ? 'active' : ''}" onclick="setEquipment(${i}, 'own'); renderBookingForm(window._currentSlot);">Свой шлем</button>
                        <button type="button" class="btn btn-outline-secondary ${isRental ? 'active' : ''}" ${(currentBooking.equipment.filter(e=>e==='rental').length >= helmetsAvailable && !isRental) ? 'disabled' : ''} onclick="setEquipment(${i}, 'rental'); renderBookingForm(window._currentSlot);">Прокатный шлем</button>
                    </div>
                </div>`;
        }
        container.innerHTML = html;
    }

    window._currentSlot = slot;
    window.setEquipment = (index, value) => {
        currentBooking.equipment[index] = value;
        recalcPrice();
        renderEquipmentRows();
    };
    window.changeKarts = (delta) => {
        const newKarts = currentBooking.karts + delta;
        if (newKarts < 1 || newKarts > maxKarts) return;
        currentBooking.karts = newKarts;
        while (currentBooking.equipment.length < newKarts) {
            const defaultEquip = (slot.free_helmets > currentBooking.equipment.filter(e=>e==='rental').length) ? 'rental' : 'own';
            currentBooking.equipment.push(defaultEquip);
        }
        currentBooking.equipment = currentBooking.equipment.slice(0, newKarts);
        recalcPrice();
        renderBookingForm(slot);
    };

    const screen = document.getElementById('screen-booking-form');
    screen.innerHTML = `
        <div id="booking-form-content">
            <div class="mb-3"><strong>${slot.track_name}</strong> — ${formatDateTime(slot.start_at)}</div>
            <div class="mb-3">
                <label class="form-label">Число картов</label>
                <div class="d-flex align-items-center">
                    <button class="btn btn-outline-secondary" onclick="changeKarts(-1)">−</button>
                    <span class="mx-3 fs-5">${currentBooking.karts}</span>
                    <button class="btn btn-outline-secondary" onclick="changeKarts(1)" ${currentBooking.karts >= maxKarts ? 'disabled' : ''}>+</button>
                </div>
                <div class="form-text">Можно записать до ${maxKarts} мест</div>
            </div>
            <div id="equipment-rows" class="mb-3"></div>
            <div class="mb-3">
                <label class="form-label">Особые отметки</label>
                <textarea class="form-control" id="restrictions-input" placeholder="Например, рост или опыт" onchange="currentBooking.restrictions = this.value">${currentBooking.restrictions}</textarea>
            </div>
            <div class="card mb-3"><div class="card-body p-3">
                <div class="d-flex justify-content-between">
                    <span>Карты: ${pricePerKart} ₽ × ${currentBooking.karts}</span>
                    <span>${pricePerKart * currentBooking.karts} ₽</span>
                </div>
                <div id="helmet-cost-row" class="d-flex justify-content-between mt-1" style="display: ${currentBooking.equipment.filter(e=>e==='rental').length > 0 ? 'flex' : 'none'}">
                    <span>Шлемы: ${helmetPrice} ₽ × ${currentBooking.equipment.filter(e=>e==='rental').length}</span>
                    <span>${helmetPrice * currentBooking.equipment.filter(e=>e==='rental').length} ₽</span>
                </div>
                <div class="d-flex justify-content-between mt-2 fw-bold">
                    <span>Итого</span>
                    <span id="price-total">0 ₽</span>
                </div>
                <div class="text-muted mt-2">Оплата на месте: наличные или перевод</div>
            </div></div>
            <button id="cta-book" class="btn btn-primary-custom w-100" onclick="confirmBooking()">Записаться</button>
            <div id="booking-error" class="mt-3"></div>
        </div>
    `;
    renderEquipmentRows();
    recalcPrice();
    document.getElementById('restrictions-input').value = currentBooking.restrictions;
}

async function confirmBooking(isRetry = false) {
    if (!isRetry || !currentBooking.idempotencyKey) {
        currentBooking.idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    }
    const body = {
        slot_id: currentBooking.slotId,
        karts_count: currentBooking.karts,
        rental_count: currentBooking.equipment.filter(e => e === 'rental').length,
        restrictions: currentBooking.restrictions
    };
    const cta = document.getElementById('cta-book');
    const errorBox = document.getElementById('booking-error');
    errorBox.innerHTML = '';
    cta.disabled = true;
    cta.textContent = 'Бронирование...';

    try {
        const booking = await apiPost('/bookings', body, { 'Idempotency-Key': currentBooking.idempotencyKey });
        showBookingSuccess(booking);
    } catch (err) {
        const code = err.code;
        const details = err.details || {};
        let message = err.message || 'Не удалось создать бронь';
        let action = null;

        switch (code) {
            case 'slot_full':
                if (details.available_karts && details.available_karts > 0) {
                    message = `Недостаточно картов. Свободно: ${details.available_karts}.`;
                    action = async () => {
                        currentBooking.karts = details.available_karts;
                        while (currentBooking.equipment.length > details.available_karts) currentBooking.equipment.pop();
                        try {
                            const freshSlot = await apiGet(`/slots/${currentBooking.slotId}`);
                            window._currentSlot = freshSlot;
                            renderBookingForm(freshSlot);
                        } catch (e) { renderBookingForm(window._currentSlot); }
                        currentBooking.idempotencyKey = null;
                    };
                } else {
                    message = 'Все карты заняты. Заезд заполнен.';
                    action = () => goBackToSlots();
                }
                break;
            case 'double_booking':
                message = 'У вас уже есть бронь на этот заезд.';
                action = () => goToBookings();
                break;
            case 'slot_cancelled':
                message = 'Заезд отменён центром.';
                action = () => goBackToSlots();
                break;
            case 'slot_started':
                message = 'Заезд уже начался.';
                action = () => goBackToSlots();
                break;
            default:
                if (!navigator.onLine) {
                    message = 'Проверьте соединение и повторите.';
                    action = () => confirmBooking(true);
                }
        }

        if (action) {
            errorBox.innerHTML = `<div class="alert alert-danger">${message} <button class="btn btn-sm btn-outline-secondary ms-2" id="error-action-btn">OK</button></div>`;
            document.getElementById('error-action-btn').addEventListener('click', () => { action(); errorBox.innerHTML = ''; });
        } else {
            showSnackbar(message, 'error');
            cta.disabled = false;
            cta.textContent = 'Записаться';
        }
    }
}
window.confirmBooking = confirmBooking;

// ---------- BS-002: Успех бронирования ----------
function showBookingSuccess(booking) {
    showScreen('booking-success');
    let screen = document.getElementById('screen-booking-success');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-success" class="screen active">
            <div class="text-center my-4"><div class="fs-1 text-success">✓</div><h4>Вы записаны!</h4></div>
            <div id="success-content" class="flex-grow-1"></div>
            <button class="btn btn-outline-primary w-100 mb-2" onclick="goToBookings()">Мои брони</button>
            <button id="add-calendar-btn" class="btn btn-outline-secondary w-100 mb-2" style="display:none;">Добавить в календарь</button>
            <button class="btn btn-outline-secondary w-100" onclick="goBackToSlotsFromSuccess()">Готово</button>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-success');
    screen.classList.add('active');
    const content = document.getElementById('success-content');

    apiGet(`/bookings/${booking.id}`).then(b => {
        content.innerHTML = `
            <div class="card mb-3"><div class="card-body p-3">
                <div><strong>${formatDateTime(b.slot_start)}</strong></div>
                <div>${b.track_name}</div>
                <div>Маршал: ${b.marshal_name}</div>
                <div>Картов: ${b.karts_count} (шлемов напрокат: ${b.rental_count})</div>
                ${b.restrictions ? `<div>Особые отметки: ${b.restrictions}</div>` : ''}
                <div class="fs-5 mt-2"><strong>${b.price_total} ₽</strong></div>
                <div class="text-muted">Оплата на месте</div>
            </div></div>`;
        const calBtn = document.getElementById('add-calendar-btn');
        if (calBtn) { calBtn.style.display = 'block'; calBtn.onclick = () => addToCalendar(b.slot_start, b.track_name); }
    }).catch(() => {
        content.innerHTML = `<p>Бронь #${booking.id} создана</p>`;
    });

    if (booking.is_first_booking && !localStorage.getItem('push_permission_requested')) {
        localStorage.setItem('push_permission_requested', 'true');
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
}

function addToCalendar(startAt, title) {
    if (!startAt) return;
    const start = new Date(startAt);
    const end = new Date(start.getTime() + 20 * 60 * 1000);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title || 'Картинг')}&dates=${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    window.open(url, '_blank');
}

function goBackToSlotsFromSuccess() {
    const screen = document.getElementById('screen-booking-success');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('slots');
}
window.goBackToSlotsFromSuccess = goBackToSlotsFromSuccess;

function goToBookings() {
    const screen = document.getElementById('screen-booking-success');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('bookings');
    loadMyBookings();
}
window.goToBookings = goToBookings;

// ---------- SCR-006: Детали брони ----------
async function showBookingDetails(bookingId) {
    showScreen('booking-details');
    let screen = document.getElementById('screen-booking-details');
    if (!screen) {
        const screenHtml = `
        <div id="screen-booking-details" class="screen active">
            <div class="d-flex align-items-center mb-3">
                <button class="btn btn-outline-secondary btn-sm me-2" onclick="goBackToBookings()">← Назад</button>
                <h5 class="m-0">Детали брони</h5>
            </div>
            <div id="booking-details-content" class="flex-grow-1"></div>
        </div>`;
        document.querySelector('.app-container').insertAdjacentHTML('afterbegin', screenHtml);
    }
    screen = document.getElementById('screen-booking-details');
    screen.classList.add('active');
    const content = document.getElementById('booking-details-content');
    content.innerHTML = renderSkeleton('text', 8);
    try {
        const booking = await apiGet(`/bookings/${bookingId}`);
        renderBookingDetails(booking);
    } catch (err) {
        content.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="showBookingDetails('${bookingId}')">Обновить</button></div>`;
    }
}
// ✅ ИСПРАВЛЕНО: экспортируем в глобальную область
window.showBookingDetails = showBookingDetails;

function goBackToBookings() {
    const screen = document.getElementById('screen-booking-details');
    if (screen) screen.classList.remove('active');
    showScreen('main');
    switchTab('bookings');
    loadMyBookings();
}
window.goBackToBookings = goBackToBookings;

function renderBookingDetails(booking) {
    const content = document.getElementById('booking-details-content');
    const start = new Date(booking.slot_start);
    const now = new Date();
    const canCancel = booking.status === 'active' && start > now;
    const deadline = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    let statusText = '', statusColor = '';
    switch (booking.status) {
        case 'active': statusText = 'Активна'; statusColor = 'success'; break;
        case 'cancelled': statusText = 'Отменена'; statusColor = 'secondary'; break;
        case 'late_cancel': statusText = 'Поздняя отмена'; statusColor = 'warning'; break;
        case 'center_cancelled': statusText = 'Отменена центром'; statusColor = 'danger'; break;
    }
    const helmetInfo = booking.rental_count > 0 ? `Прокатных шлемов: ${booking.rental_count}` : 'Свои шлемы';
    const ownKarts = booking.karts_count - booking.rental_count;
    const safeAddress = booking.center_address.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    let mapPreviewHtml = '';
    if (booking.center_lat && booking.center_lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${booking.center_lng},${booking.center_lat}&size=450,200&z=15&l=map&pt=${booking.center_lng},${booking.center_lat},pm2rdm`;
        mapPreviewHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта">`;
    }

    const trackTypeLabel = booking.track_type === 'novice' ? 'Новичковая' : 'Опытная';

    content.innerHTML = `
        <div class="mb-3"><span class="badge bg-${statusColor} fs-6">${statusText}</span></div>
        <div class="card mb-2"><div class="card-body p-3">
            <h5>${booking.track_name}</h5>
            <div><strong>${formatDateTime(booking.slot_start)}</strong></div>
            <div class="mt-2">${trackTypeLabel} ${booking.track_duration ? `· ~${booking.track_duration} мин` : ''}</div>
            <div>Маршал: ${booking.marshal_name}</div>
            ${booking.track_description ? `<p class="text-secondary mt-2">${booking.track_description}</p>` : ''}
        </div></div>
        ${mapPreviewHtml}
        <div class="card mb-2" onclick="showStudioAddress('${safeAddress}', ${booking.center_lat || null}, ${booking.center_lng || null})" style="cursor:pointer;">
            <div class="card-body p-3"><strong>Адрес:</strong> ${booking.center_address}</div>
        </div>
        <div class="card mb-2"><div class="card-body p-3">
            <div><strong>Картов:</strong> ${booking.karts_count} (${helmetInfo}, ${ownKarts} свой)</div>
            ${booking.restrictions ? `<div class="mt-2"><strong>Особые отметки:</strong> ${booking.restrictions}</div>` : ''}
        </div></div>
        <div class="card mb-2"><div class="card-body p-3">
            <div class="d-flex justify-content-between"><span>Карты: ${booking.slot_price} ₽ × ${booking.karts_count}</span><span>${booking.slot_price * booking.karts_count} ₽</span></div>
            ${booking.rental_count > 0 ? `<div class="d-flex justify-content-between mt-1"><span>Шлемы: ${booking.slot_rental_price} ₽ × ${booking.rental_count}</span><span>${booking.slot_rental_price * booking.rental_count} ₽</span></div>` : ''}
            <div class="d-flex justify-content-between mt-2 fw-bold"><span>Итого</span><span>${booking.price_total} ₽</span></div>
            <div class="text-muted mt-2">Оплата на месте: наличные или перевод</div>
        </div></div>
        <div class="text-secondary small mt-2">Записано: ${formatDateTime(booking.created_at)}</div>
        ${booking.cancelled_at ? `<div class="text-secondary small">Отменено: ${formatDateTime(booking.cancelled_at)}</div>` : ''}
        ${canCancel ? `<div class="mt-2 text-secondary small">Бесплатная отмена до ${formatDateTime(deadline.toISOString())}</div>` : ''}
        ${canCancel ? `<button class="btn btn-outline-danger w-100 mt-3" onclick="initCancelBooking('${booking.id}')">Отменить бронь</button>` : ''}
        ${!canCancel && booking.status === 'active' ? `<button class="btn btn-outline-danger w-100 mt-3" disabled>Заезд уже начался</button>` : ''}
    `;
}

// ---------- BS-003: Отмена ----------
let cancelBookingId = null;
function initCancelBooking(bookingId) {
    cancelBookingId = bookingId;
    const modal = document.getElementById('cancel-modal');
    if (!modal) {
        const modalHtml = `
        <div class="modal fade" id="cancel-modal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header"><h5 class="modal-title">Отменить бронь?</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
              <div class="modal-body" id="cancel-modal-body">Загрузка...</div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Не отменять</button>
                <button type="button" class="btn btn-danger" id="confirm-cancel-btn" disabled>Подтвердить отмену</button>
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    apiGet(`/bookings/${bookingId}`).then(booking => {
        const start = new Date(booking.slot_start);
        const now = new Date();
        const hoursLeft = (start - now) / (1000 * 60 * 60);
        const isEarly = hoursLeft >= 2;
        const body = document.getElementById('cancel-modal-body');
        body.innerHTML = `
            <p>${isEarly ? 'Место освободится и станет доступно другим.' : 'Поздняя отмена: место не освобождается. Штраф не взимается.'}</p>
            <p class="text-muted small">Правило: отмена не позднее чем за 2 часа до начала — место освобождается.</p>`;
        const confirmBtn = document.getElementById('confirm-cancel-btn');
        confirmBtn.disabled = false;
        confirmBtn.onclick = executeCancel;
    }).catch(err => { showSnackbar('Не удалось загрузить данные', 'error'); });
    new bootstrap.Modal(document.getElementById('cancel-modal')).show();
}
window.initCancelBooking = initCancelBooking;

async function executeCancel() {
    const btn = document.getElementById('confirm-cancel-btn');
    btn.disabled = true; btn.textContent = 'Отмена...';
    try {
        await apiPost(`/bookings/${cancelBookingId}/cancel`);
        bootstrap.Modal.getInstance(document.getElementById('cancel-modal')).hide();
        showBookingDetails(cancelBookingId);
    } catch (err) {
        showSnackbar(err.message || 'Не удалось отменить', 'error');
        btn.disabled = false; btn.textContent = 'Подтвердить отмену';
    }
}

// ---------- BS-004: Адрес центра ----------
function showStudioAddress(address, lat, lng) {
    const oldModal = document.getElementById('studio-address-modal');
    if (oldModal) oldModal.remove();
    let mapHtml = '';
    if (lat && lng) {
        const staticMapUrl = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&size=600,400&z=15&l=map&pt=${lng},${lat},pm2rdm`;
        mapHtml = `<img src="${staticMapUrl}" class="img-fluid rounded mb-2" alt="Карта">`;
    }
    const modalHtml = `
    <div class="modal fade" id="studio-address-modal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Адрес центра</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
        <div class="modal-body text-center"><p class="fs-5">${address}</p>${mapHtml}<a href="https://yandex.ru/maps/?text=${encodeURIComponent(address)}" target="_blank" class="btn btn-outline-primary btn-sm">Открыть в Яндекс.Картах</a></div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('studio-address-modal')).show();
}
window.showStudioAddress = showStudioAddress;