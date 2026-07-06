function formatDate(iso) {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
}
function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(iso) {
    return formatDate(iso) + ', ' + formatTime(iso);
}
function showSnackbar(message, type = 'error') {
    const snackbar = document.createElement('div');
    snackbar.className = `snackbar snackbar-${type}`;
    snackbar.textContent = message;
    document.body.appendChild(snackbar);
    setTimeout(() => snackbar.classList.add('show'), 10);
    setTimeout(() => {
        snackbar.classList.remove('show');
        setTimeout(() => snackbar.remove(), 300);
    }, 3000);
}
function renderSkeleton(type = 'card', count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        if (type === 'card') {
            html += `<div class="skeleton-card mb-2"><div class="skeleton-line skeleton-title mb-1"></div><div class="skeleton-line skeleton-text short mb-1"></div><div class="skeleton-line skeleton-text mb-1"></div><div class="d-flex justify-content-between mt-2"><div class="skeleton-line skeleton-price"></div><div class="skeleton-line skeleton-price"></div></div></div>`;
        } else if (type === 'booking-card') {
            html += `<div class="skeleton-card mb-2"><div class="d-flex justify-content-between mb-1"><div class="skeleton-line skeleton-title"></div><div class="skeleton-line skeleton-badge"></div></div><div class="skeleton-line skeleton-text short mb-1"></div><div class="skeleton-line skeleton-text mb-1"></div><div class="d-flex justify-content-between"><div class="skeleton-line skeleton-price"></div><div class="skeleton-line skeleton-price"></div></div></div>`;
        } else if (type === 'profile') {
            html += `<div class="skeleton-card mb-2"><div class="d-flex justify-content-between align-items-center mb-3"><div><div class="skeleton-line skeleton-text short mb-1"></div><div class="skeleton-line skeleton-title"></div></div><div class="skeleton-line skeleton-icon"></div></div><div class="d-flex justify-content-between align-items-center"><div><div class="skeleton-line skeleton-text short mb-1"></div><div class="skeleton-line skeleton-title"></div></div><div class="skeleton-line skeleton-icon"></div></div></div>`;
        }
    }
    return html;
}