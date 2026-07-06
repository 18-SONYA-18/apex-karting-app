// mybookings.js — SCR-005: Мои записи (Картинг)

let bookingsCache = [];
let currentBookingsTab = 'upcoming';

async function loadMyBookings() {
    const container = document.getElementById('tab-bookings');
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="m-0">Мои записи</h5>
        </div>
        <div class="btn-group w-100 mb-3" role="group">
            <button type="button" class="btn btn-outline-secondary active" id="tab-upcoming" onclick="switchBookingsTab('upcoming')">Предстоящие</button>
            <button type="button" class="btn btn-outline-secondary" id="tab-past" onclick="switchBookingsTab('past')">Прошедшие</button>
        </div>
        <div id="bookings-content">${renderSkeleton('booking-card', 3)}</div>
    `;

    try {
        const bookings = await apiGet('/bookings');
        bookingsCache = bookings;
        renderBookingsByTab(currentBookingsTab);
    } catch (err) {
        document.getElementById('bookings-content').innerHTML = `
            <div class="text-center my-5 text-danger">
                Не удалось загрузить записи.<br>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadMyBookings()">Обновить</button>
            </div>`;
    }
}
// ✅ ИСПРАВЛЕНО: экспортируем в глобальную область
window.loadMyBookings = loadMyBookings;

function switchBookingsTab(tab) {
    currentBookingsTab = tab;
    document.getElementById('tab-upcoming').classList.toggle('active', tab === 'upcoming');
    document.getElementById('tab-past').classList.toggle('active', tab === 'past');
    renderBookingsByTab(tab);
}
window.switchBookingsTab = switchBookingsTab;

function renderBookingsByTab(tab) {
    const now = new Date();
    let filtered = bookingsCache.filter(b => {
        const start = new Date(b.slot_start);
        const isPast = start <= now ||
                       b.status === 'cancelled' ||
                       b.status === 'late_cancel' ||
                       b.status === 'center_cancelled';
        return tab === 'upcoming' ? !isPast : isPast;
    });

    filtered.sort((a, b) => {
        const dateA = new Date(a.slot_start);
        const dateB = new Date(b.slot_start);
        return tab === 'upcoming' ? dateA - dateB : dateB - dateA;
    });

    const container = document.getElementById('bookings-content');

    if (filtered.length === 0) {
        const emptyMessage = tab === 'upcoming'
            ? 'Пока нет предстоящих записей'
            : 'Здесь появятся прошедшие заезды';
        container.innerHTML = `
            <div class="text-center my-5 text-muted">
                ${emptyMessage}<br>
                <button class="btn btn-sm btn-outline-secondary mt-2" onclick="switchTab('slots'); loadSlots();">Записаться на заезд</button>
            </div>`;
        return;
    }

    let html = '';
    filtered.forEach(b => {
        const start = new Date(b.slot_start);
        const dateStr = start.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        let statusText = '', statusColor = '';
        switch (b.status) {
            case 'active':
                statusText = 'Активна';
                statusColor = 'success';
                break;
            case 'cancelled':
                statusText = 'Отменена';
                statusColor = 'secondary';
                break;
            case 'late_cancel':
                statusText = 'Поздняя отмена';
                statusColor = 'warning';
                break;
            case 'center_cancelled':
                statusText = 'Отменена центром';
                statusColor = 'danger';
                break;
        }

        const helmetInfo = b.rental_count > 0
            ? `${b.rental_count} прокатн.`
            : 'свои шлемы';

        html += `
            <div class="card mb-2" onclick="showBookingDetails('${b.id}')" style="cursor:pointer;">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-1">
                        <div>
                            <div class="fw-bold">${dateStr}, ${timeStr}</div>
                            <div>${b.track_name}</div>
                        </div>
                        <span class="badge bg-${statusColor}">${statusText}</span>
                    </div>
                    <div class="d-flex justify-content-between mt-2">
                        <span class="text-secondary small">Маршал: ${b.marshal_name}</span>
                        <span class="text-secondary small">Картов: ${b.karts_count} (${helmetInfo})</span>
                    </div>
                    <div class="d-flex justify-content-between mt-1">
                        <span class="fw-bold">${b.price_total} ₽</span>
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}