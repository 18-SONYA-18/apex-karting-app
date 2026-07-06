// slots.js — SCR-002: Список слотов + фильтры (Картинг)

const filters = { date_from: '', date_to: '', track_type: [], marshal_id: [], only_available: false };
let filtersApplied = false;

async function loadSlots() {
    initSlotsHeader();
    const container = document.getElementById('tab-slots');
    container.innerHTML = renderSkeleton('card', 3);
    try {
        const params = new URLSearchParams();
        if (filtersApplied) {
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);
            filters.track_type.forEach(t => params.append('track_type', t));
            filters.marshal_id.forEach(id => params.append('marshal_id', id));
            if (filters.only_available) params.append('only_available', 'true');
        }
        const slots = await apiGet(`/slots${params.toString() ? '?' + params.toString() : ''}`);
        renderSlots(slots);
    } catch (err) {
        container.innerHTML = `<div class="text-center my-5 text-danger">Не удалось загрузить.<br><button class="btn btn-sm btn-outline-primary mt-2" onclick="loadSlots()">Обновить</button></div>`;
    }
}

function renderSlots(slots) {
    const container = document.getElementById('tab-slots');
    if (slots.length === 0) {
        const message = filtersApplied ? 'Ничего не найдено по фильтрам' : 'Пока нет доступных заездов';
        const actionHtml = filtersApplied ? '<button class="btn btn-sm btn-outline-secondary mt-2" onclick="openFilters()">Изменить фильтры</button>' : '';
        container.innerHTML = `<div class="text-center my-5 text-muted">${message}<br>${actionHtml}</div>`;
        return;
    }
    const grouped = {};
    slots.forEach(s => {
        const dateKey = new Date(s.start_at).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(s);
    });
    let html = '';
    for (const [date, items] of Object.entries(grouped)) {
        html += `<div class="fw-bold text-secondary mt-3 mb-2">${date}</div>`;
        items.forEach(slot => {
            const time = new Date(slot.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const freeText = slot.free_karts > 0 ? `Свободно ${slot.free_karts} из ${slot.total_karts}` : 'Мест нет';
            const disabledClass = slot.free_karts === 0 ? 'text-muted' : '';
            const clickHandler = slot.free_karts > 0 ? `onclick="openSlot('${slot.id}')"` : '';
            // ✅ ИСПРАВЛЕНО: 'novice' вместо 'beginner'
            const trackTypeLabel = slot.track_type === 'novice' ? 'Новичковая' : 'Опытная';
            html += `<div class="card mb-2 ${disabledClass}" ${clickHandler} style="${slot.free_karts > 0 ? 'cursor:pointer;' : ''}"><div class="card-body p-3"><div class="d-flex justify-content-between"><strong>${time}</strong><span class="badge bg-secondary">${trackTypeLabel}</span></div><div>${slot.track_name}</div><div class="text-secondary small">Маршал: ${slot.marshal_name}</div><div class="d-flex justify-content-between mt-2"><span>${slot.price} ₽</span><span class="${slot.free_karts === 0 ? 'text-danger' : 'text-success'}">${freeText}</span></div></div></div>`;
        });
    }
    container.innerHTML = html;
}

async function loadMarshalsForFilter() {
    try {
        const marshals = await apiGet('/marshals');
        const container = document.getElementById('marshal-filter-container');
        if (!container) return;
        let html = '';
        marshals.forEach(m => {
            const checked = filters.marshal_id.includes(m.id) ? 'checked' : '';
            html += `<div class="form-check"><input class="form-check-input" type="checkbox" value="${m.id}" id="marshal-${m.id}" ${checked} onchange="updateMarshalFilter()"><label class="form-check-label" for="marshal-${m.id}">${m.name}</label></div>`;
        });
        container.innerHTML = html || '';
    } catch (err) {
        const container = document.getElementById('marshal-filter-container');
        if (container) container.innerHTML = '<div class="text-danger small">Не удалось загрузить список маршалов</div>';
    }
}

function updateMarshalFilter() {
    filters.marshal_id = Array.from(document.querySelectorAll('#marshal-filter-container input:checked')).map(cb => cb.value);
}

function openFilters() {
    const modal = document.getElementById('filter-modal');
    if (!modal) {
        const modalHtml = `<div class="modal fade" id="filter-modal" tabindex="-1"><div class="modal-dialog modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Фильтры</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body">
            <div class="mb-3"><label class="form-label fw-bold">Дата</label><div class="d-flex gap-2 mb-2"><button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('today')">Сегодня</button><button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('week')">Эта неделя</button><button class="btn btn-outline-secondary btn-sm" onclick="setDatePreset('weekend')">Выходные</button></div><div class="row g-2"><div class="col-6"><input type="date" id="filter-date-from" class="form-control" value="${filters.date_from}"></div><div class="col-6"><input type="date" id="filter-date-to" class="form-control" value="${filters.date_to}"></div></div></div>
            <div class="mb-3"><label class="form-label fw-bold">Тип трассы</label><div class="form-check"><input class="form-check-input" type="checkbox" value="novice" id="type-novice" ${filters.track_type.includes('novice') ? 'checked' : ''}><label class="form-check-label" for="type-novice">Новичковая</label></div><div class="form-check"><input class="form-check-input" type="checkbox" value="experienced" id="type-experienced" ${filters.track_type.includes('experienced') ? 'checked' : ''}><label class="form-check-label" for="type-experienced">Опытная</label></div></div>
            <div class="mb-3"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" id="only-available" ${filters.only_available ? 'checked' : ''}><label class="form-check-label fw-bold" for="only-available">Только со свободными местами</label></div></div>
            <div class="mb-3"><label class="form-label fw-bold">Маршал</label><div id="marshal-filter-container">Загрузка...</div></div>
        </div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" onclick="resetFilters()">Сбросить</button><button type="button" class="btn btn-primary-custom" onclick="applyFilters()">Применить</button></div></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        loadMarshalsForFilter();
    } else {
        document.getElementById('filter-date-from').value = filters.date_from;
        document.getElementById('filter-date-to').value = filters.date_to;
        loadMarshalsForFilter();
    }
    new bootstrap.Modal(document.getElementById('filter-modal')).show();
}

function setDatePreset(preset) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let date_from = today, date_to = today;
    if (preset === 'today') { /* nothing */ }
    else if (preset === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        date_from = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        date_to = sunday.toISOString().slice(0, 10);
    } else if (preset === 'weekend') {
        const day = now.getDay();
        const saturday = new Date(now);
        saturday.setDate(now.getDate() + (6 - day + 1) % 7);
        date_from = saturday.toISOString().slice(0, 10);
        const sunday = new Date(saturday);
        sunday.setDate(sunday.getDate() + 1);
        date_to = sunday.toISOString().slice(0, 10);
    }
    document.getElementById('filter-date-from').value = date_from;
    document.getElementById('filter-date-to').value = date_to;
}

function applyFilters() {
    filters.date_from = document.getElementById('filter-date-from').value;
    filters.date_to = document.getElementById('filter-date-to').value;
    filters.only_available = document.getElementById('only-available').checked;
    filters.track_type = [];
    // ✅ ИСПРАВЛЕНО: 'novice' вместо 'beginner'
    if (document.getElementById('type-novice').checked) filters.track_type.push('novice');
    if (document.getElementById('type-experienced').checked) filters.track_type.push('experienced');
    filtersApplied = !!(filters.date_from || filters.date_to || filters.track_type.length || filters.marshal_id.length || filters.only_available);
    bootstrap.Modal.getInstance(document.getElementById('filter-modal')).hide();
    updateFilterIndicator();
    loadSlots();
}

function resetFilters() {
    filters.date_from = '';
    filters.date_to = '';
    filters.track_type = [];
    filters.marshal_id = [];
    filters.only_available = false;
    filtersApplied = false;
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('only-available').checked = false;
    // ✅ ИСПРАВЛЕНО: 'novice' вместо 'beginner'
    document.getElementById('type-novice').checked = false;
    document.getElementById('type-experienced').checked = false;
    document.querySelectorAll('#marshal-filter-container input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateFilterIndicator();
}

function updateFilterIndicator() {
    const indicator = document.getElementById('filter-indicator');
    if (!indicator) return;
    if (filtersApplied) {
        let count = 0;
        if (filters.date_from || filters.date_to) count++;
        if (filters.track_type.length) count++;
        if (filters.marshal_id.length) count++;
        if (filters.only_available) count++;
        indicator.textContent = count;
        indicator.style.display = 'inline-block';
    } else { indicator.style.display = 'none'; }
}

function initSlotsHeader() {
    const tabSlots = document.getElementById('tab-slots');
    if (!document.getElementById('slots-header')) {
        const header = document.createElement('div');
        header.id = 'slots-header';
        header.className = 'd-flex justify-content-between align-items-center mb-3';
        header.innerHTML = `<h5 class="m-0">Заезды</h5><button class="btn btn-outline-secondary btn-sm position-relative" onclick="openFilters()"><i class="bi bi-funnel"></i> Фильтры<span id="filter-indicator" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="display:none;"></span></button>`;
        tabSlots.parentNode.insertBefore(header, tabSlots);
    }
}