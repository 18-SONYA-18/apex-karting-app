const state = { phone: '', isNew: false };
document.addEventListener('DOMContentLoaded', () => {
    if (sessionTokens.access) { showScreen('main'); switchTab('slots'); loadSlots(); }
    else { showScreen('login'); renderLogin(); }
    document.querySelectorAll('.tab-bar .tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = tab.getAttribute('data-tab');
            switchTab(tabName);
            if (tabName === 'slots') loadSlots();
            else if (tabName === 'bookings') loadMyBookings();
            else if (tabName === 'profile') loadProfile();
        });
    });
});
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById('screen-' + name);
    if (screen) screen.classList.add('active');
}
function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    const tab = document.getElementById('tab-' + tabName);
    if (tab) tab.style.display = 'block';
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.tab-bar .tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active');
}