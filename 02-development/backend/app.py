"""
Apex Karting Backend API
------------------------
Клиентское веб-приложение картинг-центра (MVP).
Flask + SQLite, адаптировано под мобильный frontend.
Реализованы все критичные сценарии: авторизация по OTP, просмотр слотов,
бронирование с защитой от двойных записей, отмена по правилу 2 часов, профиль.
"""

import os, uuid, hashlib, secrets, re
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS
import sqlite3

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)
app.config['SECRET_KEY'] = secrets.token_hex(16)

DATABASE = os.path.join(os.path.dirname(__file__), 'apex_karting.db')


# ---------- Database ----------
def get_db():
    db = sqlite3.connect(DATABASE, check_same_thread=False,
                         detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY,
                phone TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active'
            );
            CREATE TABLE IF NOT EXISTS marshals (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS track_configs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT,
                duration_min INTEGER,
                capacity_cap INTEGER NOT NULL,
                image_url TEXT
            );
            CREATE TABLE IF NOT EXISTS slots (
                id TEXT PRIMARY KEY,
                track_config_id TEXT NOT NULL REFERENCES track_configs(id),
                marshal_id TEXT NOT NULL REFERENCES marshals(id),
                start_at TIMESTAMP NOT NULL,
                total_karts INTEGER NOT NULL,
                free_karts INTEGER NOT NULL,
                free_helmets INTEGER NOT NULL,
                price REAL NOT NULL,
                rental_price REAL NOT NULL,
                center_address TEXT NOT NULL,
                center_lat REAL,
                center_lng REAL,
                status TEXT DEFAULT 'scheduled'
            );
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                client_id TEXT NOT NULL REFERENCES clients(id),
                slot_id TEXT NOT NULL REFERENCES slots(id),
                karts_count INTEGER NOT NULL,
                rental_count INTEGER NOT NULL,
                restrictions TEXT,
                price_total REAL NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cancelled_at TIMESTAMP,
                idempotency_key TEXT UNIQUE,
                cancel_reason TEXT
            );
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                client_id TEXT NOT NULL REFERENCES clients(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS otp_codes (
                phone TEXT PRIMARY KEY,
                code_hash TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                attempts INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS push_tokens (
                id TEXT PRIMARY KEY,
                client_id TEXT NOT NULL REFERENCES clients(id),
                token TEXT NOT NULL,
                platform TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(client_id, token)
            );
            CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
            CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
            CREATE INDEX IF NOT EXISTS idx_slots_start ON slots(start_at);
            CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
            CREATE INDEX IF NOT EXISTS idx_push_tokens_client ON push_tokens(client_id);
        ''')
        db.commit()
        seed_test_data(db)


def seed_test_data(db):
    if db.execute("SELECT COUNT(*) FROM marshals").fetchone()[0] == 0:
        db.executescript('''
            INSERT INTO marshals (id, name) VALUES ('1', 'Алексей'), ('2', 'Дмитрий'), ('3', 'Ольга');
            INSERT INTO track_configs (id, name, type, description, duration_min, capacity_cap) VALUES
                ('t1', 'Короткая трасса', 'novice', 'Упрощённая конфигурация для новичков', 15, 8),
                ('t2', 'Длинная трасса', 'experienced', 'Полная конфигурация с шпильками', 20, 14);
            INSERT INTO slots (id, track_config_id, marshal_id, start_at, total_karts, free_karts, free_helmets, price, rental_price, center_address, center_lat, center_lng)
            VALUES
                ('s1', 't1', '1', datetime('now', '+1 day', '+10 hours'), 8, 4, 5, 1500, 300, 'Картинг-центр "Апекс", ул. Гоночная, 7', 55.7558, 37.6173),
                ('s2', 't2', '2', datetime('now', '+2 days', '+14 hours'), 14, 10, 2, 2000, 300, 'Картинг-центр "Апекс", ул. Гоночная, 7', NULL, NULL);
        ''')
        db.commit()


init_db()


# ---------- Helpers ----------
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return error_response("unauthorized", "Требуется авторизация", 401)
        db = get_db()
        session = db.execute("SELECT * FROM auth_sessions WHERE token = ?", (token,)).fetchone()
        if not session:
            return error_response("unauthorized", "Сессия недействительна", 401)
        g.client_id = session['client_id']
        g.token = token
        return f(*args, **kwargs)
    return decorated


def generate_otp():
    return str(secrets.randbelow(10**4)).zfill(4)


def hash_code(code):
    return hashlib.sha256(code.encode()).hexdigest()


def error_response(code, message, status_code=400, details=None):
    body = {"code": code, "message": message}
    if details:
        body["details"] = details
    return jsonify(body), status_code


@app.errorhandler(Exception)
def handle_exception(e):
    app.logger.error(f"Unhandled exception: {e}")
    return error_response("internal_error", "Внутренняя ошибка сервера", 500)


def as_utc(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def utcnow():
    return datetime.now(timezone.utc)


# ---------- Auth API ----------
@app.route('/api/auth/request-code', methods=['POST'])
def request_code():
    data = request.get_json()
    phone = (data.get('phone') or '').strip()
    if not re.match(r'^\+[1-9]\d{1,14}$', phone):
        return error_response("bad_request", "Неверный формат телефона")
    db = get_db()
    code = generate_otp()
    expires = utcnow() + timedelta(minutes=5)
    db.execute("INSERT OR REPLACE INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
               (phone, hash_code(code), expires))
    db.commit()
    print(f"SMS OTP for {phone}: {code}")
    return jsonify({"ttl_seconds": 300, "resend_after_seconds": 30})


@app.route('/api/auth/verify-code', methods=['POST'])
def verify_code():
    data = request.get_json()
    phone = (data.get('phone') or '').strip()
    code = (data.get('code') or '').strip()
    if not re.match(r'^\+[1-9]\d{1,14}$', phone) or not re.match(r'^\d{4,6}$', code):
        return error_response("bad_request", "Неверный формат телефона или кода")
    db = get_db()
    otp = db.execute("SELECT * FROM otp_codes WHERE phone = ?", (phone,)).fetchone()
    if not otp or as_utc(otp['expires_at']) < utcnow():
        return error_response("invalid_code", "Код неверен или просрочен")
    if otp['attempts'] >= 5:
        return error_response("too_many_attempts", "Слишком много попыток", 429)
    if otp['code_hash'] != hash_code(code):
        db.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?", (phone,))
        db.commit()
        return error_response("invalid_code", "Неверный код")
    db.execute("DELETE FROM otp_codes WHERE phone = ?", (phone,))
    client = db.execute("SELECT * FROM clients WHERE phone = ? AND status = 'active'", (phone,)).fetchone()
    is_new = False
    if not client:
        client_id = str(uuid.uuid4())
        db.execute("INSERT INTO clients (id, phone, name) VALUES (?, ?, '')", (client_id, phone))
        client = db.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        is_new = True
    else:
        client_id = client['id']
    token = secrets.token_hex(32)
    db.execute("INSERT INTO auth_sessions (token, client_id) VALUES (?, ?)", (token, client_id))
    db.commit()
    return jsonify({
        "tokens": {"access_token": token, "refresh_token": token, "token_type": "Bearer", "expires_in": 900},
        "client": {"id": client['id'], "phone": client['phone'], "name": client['name']},
        "is_new": is_new
    })


@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    data = request.get_json()
    refresh = (data.get('refresh_token') or '').strip()
    if not refresh:
        return error_response("bad_request", "refresh_token обязателен")
    db = get_db()
    session = db.execute("SELECT * FROM auth_sessions WHERE token = ?", (refresh,)).fetchone()
    if not session:
        return error_response("unauthorized", "Неверный refresh-токен", 401)
    new_token = secrets.token_hex(32)
    db.execute("DELETE FROM auth_sessions WHERE token = ?", (refresh,))
    db.execute("INSERT INTO auth_sessions (token, client_id) VALUES (?, ?)", (new_token, session['client_id']))
    db.commit()
    return jsonify({"access_token": new_token, "refresh_token": new_token, "token_type": "Bearer", "expires_in": 900})


@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    db = get_db()
    db.execute("DELETE FROM auth_sessions WHERE token = ?", (g.token,))
    db.commit()
    return '', 204


# ---------- Push Tokens API ----------
@app.route('/api/auth/push-tokens', methods=['POST'])
@require_auth
def register_push_token():
    data = request.get_json()
    token = (data.get('token') or '').strip()
    platform = (data.get('platform') or '').strip()
    if not token or platform not in ('ios', 'android'):
        return error_response("bad_request", "Неверные параметры token/platform")
    db = get_db()
    db.execute("""INSERT OR REPLACE INTO push_tokens (id, client_id, token, platform)
                  VALUES (?, ?, ?, ?)""",
               (str(uuid.uuid4()), g.client_id, token, platform))
    db.commit()
    return '', 204


@app.route('/api/auth/push-tokens', methods=['DELETE'])
@require_auth
def delete_push_token():
    data = request.get_json()
    token = (data.get('token') or '').strip()
    if not token:
        return error_response("bad_request", "token обязателен")
    db = get_db()
    db.execute("DELETE FROM push_tokens WHERE client_id = ? AND token = ?", (g.client_id, token))
    db.commit()
    return '', 204


# ---------- Profile API ----------
@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile():
    db = get_db()
    client = db.execute("SELECT id, phone, name, created_at, status FROM clients WHERE id = ?", (g.client_id,)).fetchone()
    return jsonify(dict(client))


@app.route('/api/profile', methods=['PATCH'])
@require_auth
def update_profile():
    data = request.get_json()
    name = (data.get('name') or '').strip()
    if not name or len(name) > 100:
        return error_response("bad_request", "Имя должно быть от 1 до 100 символов")
    db = get_db()
    db.execute("UPDATE clients SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (name, g.client_id))
    db.commit()
    return jsonify({"message": "Профиль обновлён"})


@app.route('/api/profile', methods=['DELETE'])
@require_auth
def delete_account():
    db = get_db()
    with db:
        active = db.execute("SELECT * FROM bookings WHERE client_id = ? AND status = 'active'", (g.client_id,)).fetchall()
        for b in active:
            db.execute("UPDATE slots SET free_karts = free_karts + ?, free_helmets = free_helmets + ? WHERE id = ?",
                       (b['karts_count'], b['rental_count'], b['slot_id']))
        db.execute("UPDATE bookings SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE client_id = ? AND status = 'active'", (g.client_id,))
        db.execute("UPDATE bookings SET client_id = NULL WHERE client_id = ?", (g.client_id,))
        db.execute("UPDATE clients SET status = 'deleted', phone = '', name = '' WHERE id = ?", (g.client_id,))
        db.execute("DELETE FROM auth_sessions WHERE client_id = ?", (g.client_id,))
        db.execute("DELETE FROM push_tokens WHERE client_id = ?", (g.client_id,))
    return '', 204


@app.route('/api/profile/phone/request-code', methods=['POST'])
@require_auth
def request_phone_change_code():
    data = request.get_json()
    new_phone = (data.get('new_phone') or '').strip()
    if not re.match(r'^\+[1-9]\d{1,14}$', new_phone):
        return error_response("bad_request", "Неверный формат телефона")
    db = get_db()
    existing = db.execute("SELECT id FROM clients WHERE phone = ? AND status = 'active' AND id != ?",
                          (new_phone, g.client_id)).fetchone()
    if existing:
        return error_response("phone_taken", "Этот номер уже используется другим клиентом", 409)
    code = generate_otp()
    expires = utcnow() + timedelta(minutes=5)
    db.execute("INSERT OR REPLACE INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)",
               (new_phone, hash_code(code), expires))
    db.commit()
    print(f"SMS OTP for phone change {new_phone}: {code}")
    return jsonify({"ttl_seconds": 300, "resend_after_seconds": 30})


@app.route('/api/profile/phone/confirm', methods=['POST'])
@require_auth
def confirm_phone_change():
    data = request.get_json()
    new_phone = (data.get('new_phone') or '').strip()
    code = (data.get('code') or '').strip()
    if not re.match(r'^\+[1-9]\d{1,14}$', new_phone) or not re.match(r'^\d{4,6}$', code):
        return error_response("bad_request", "Неверные параметры")
    db = get_db()
    otp = db.execute("SELECT * FROM otp_codes WHERE phone = ?", (new_phone,)).fetchone()
    if not otp or as_utc(otp['expires_at']) < utcnow():
        return error_response("invalid_code", "Код неверен или просрочен")
    if otp['code_hash'] != hash_code(code):
        db.execute("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?", (new_phone,))
        db.commit()
        return error_response("invalid_code", "Неверный код")
    db.execute("DELETE FROM otp_codes WHERE phone = ?", (new_phone,))
    try:
        db.execute("UPDATE clients SET phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                   (new_phone, g.client_id))
        db.commit()
    except sqlite3.IntegrityError:
        return error_response("phone_taken", "Этот номер уже используется", 409)
    client = db.execute("SELECT id, phone, name, created_at FROM clients WHERE id = ?", (g.client_id,)).fetchone()
    return jsonify(dict(client))


# ---------- Marshals API ----------
@app.route('/api/marshals', methods=['GET'])
@require_auth
def list_marshals():
    db = get_db()
    marshals = db.execute("SELECT id, name FROM marshals ORDER BY name").fetchall()
    return jsonify([dict(r) for r in marshals])


# ---------- Slots API ----------
@app.route('/api/slots', methods=['GET'])
@require_auth
def list_slots():
    db = get_db()
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    only_available = request.args.get('only_available', 'false') == 'true'
    track_type = request.args.getlist('track_type')
    marshal_id = request.args.getlist('marshal_id')

    query = """
        SELECT s.*, t.name as track_name, t.type as track_type, m.name as marshal_name
        FROM slots s
        JOIN track_configs t ON s.track_config_id = t.id
        JOIN marshals m ON s.marshal_id = m.id
        WHERE s.status = 'scheduled'
    """
    params = []
    if date_from:
        query += " AND s.start_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND s.start_at <= ?"
        params.append(date_to)
    if track_type:
        placeholders = ','.join(['?']*len(track_type))
        query += f" AND t.type IN ({placeholders})"
        params.extend(track_type)
    if marshal_id:
        placeholders = ','.join(['?']*len(marshal_id))
        query += f" AND s.marshal_id IN ({placeholders})"
        params.extend(marshal_id)
    if only_available:
        query += " AND s.free_karts > 0"
    query += " ORDER BY s.start_at ASC"
    slots = db.execute(query, params).fetchall()
    return jsonify([dict(r) for r in slots])


@app.route('/api/slots/<slot_id>', methods=['GET'])
@require_auth
def get_slot(slot_id):
    db = get_db()
    slot = db.execute("""
        SELECT s.*, t.name as track_name, t.type as track_type, t.description as track_description,
               t.duration_min as track_duration, t.capacity_cap as track_capacity_cap, m.name as marshal_name
        FROM slots s
        JOIN track_configs t ON s.track_config_id = t.id
        JOIN marshals m ON s.marshal_id = m.id
        WHERE s.id = ?
    """, (slot_id,)).fetchone()
    if not slot:
        return error_response("not_found", "Слот не найден", 404)
    return jsonify(dict(slot))


# ---------- Bookings API ----------
@app.route('/api/bookings', methods=['POST'])
@require_auth
def create_booking():
    data = request.get_json()
    slot_id = data.get('slot_id')
    karts_count = data.get('karts_count', 1)
    rental_count = data.get('rental_count', 0)
    restrictions = data.get('restrictions', '')
    idempotency_key = request.headers.get('Idempotency-Key')
    if not idempotency_key:
        return error_response("bad_request", "Idempotency-Key обязателен")

    db = get_db()
    existing = db.execute("SELECT * FROM bookings WHERE idempotency_key = ?", (idempotency_key,)).fetchone()
    if existing:
        return jsonify(dict(existing)), 201

    with db:
        slot = db.execute("SELECT s.*, t.capacity_cap FROM slots s JOIN track_configs t ON s.track_config_id = t.id WHERE s.id = ?", (slot_id,)).fetchone()
        if not slot or slot['status'] != 'scheduled':
            return error_response("slot_cancelled", "Заезд недоступен", 410)
        if as_utc(slot['start_at']) <= utcnow():
            return error_response("slot_started", "Заезд уже начался", 422)

        # ✅ ИСПРАВЛЕНО: лимит 4 вместо 3 (FR-12)
        max_karts = min(slot['free_karts'], slot['capacity_cap'], 4)
        if karts_count < 1 or karts_count > max_karts:
            return error_response("slot_full", "Недостаточно картов", 409, {"available_karts": max_karts})
        if rental_count > slot['free_helmets']:
            return error_response("slot_full", "Недостаточно шлемов напрокат", 409, {"available_helmets": slot['free_helmets']})

        double = db.execute("SELECT id FROM bookings WHERE client_id = ? AND slot_id = ? AND status = 'active'",
                            (g.client_id, slot_id)).fetchone()
        if double:
            return error_response("double_booking", "У вас уже есть бронь на этот заезд", 409)

        price_total = slot['price'] * karts_count + slot['rental_price'] * rental_count
        booking_id = str(uuid.uuid4())
        db.execute("""INSERT INTO bookings (id, client_id, slot_id, karts_count, rental_count, restrictions, price_total, status, idempotency_key)
                      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)""",
                   (booking_id, g.client_id, slot_id, karts_count, rental_count, restrictions, price_total, idempotency_key))
        db.execute("UPDATE slots SET free_karts = free_karts - ?, free_helmets = free_helmets - ? WHERE id = ?",
                   (karts_count, rental_count, slot_id))
        # ✅ ИСПРАВЛЕНО: считаем только реальные брони (не учитываем уже отменённые)
        is_first = db.execute("SELECT COUNT(*) as cnt FROM bookings WHERE client_id = ?", (g.client_id,)).fetchone()['cnt'] == 1
    booking = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    return jsonify({**dict(booking), "is_first_booking": is_first, "reminder_hours": [24, 2]}), 201


@app.route('/api/bookings', methods=['GET'])
@require_auth
def list_bookings():
    db = get_db()
    bookings = db.execute("""
        SELECT b.*, s.start_at as slot_start, t.name as track_name, m.name as marshal_name
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN track_configs t ON s.track_config_id = t.id
        JOIN marshals m ON s.marshal_id = m.id
        WHERE b.client_id = ?
        ORDER BY s.start_at DESC
    """, (g.client_id,)).fetchall()
    return jsonify([dict(r) for r in bookings])


@app.route('/api/bookings/<booking_id>', methods=['GET'])
@require_auth
def get_booking(booking_id):
    db = get_db()
    booking = db.execute("""
        SELECT b.*, s.start_at as slot_start, s.center_address, s.center_lat, s.center_lng,
               t.name as track_name, t.type as track_type, t.description as track_description,
               t.duration_min as track_duration, m.name as marshal_name,
               s.price as slot_price, s.rental_price as slot_rental_price
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN track_configs t ON s.track_config_id = t.id
        JOIN marshals m ON s.marshal_id = m.id
        WHERE b.id = ? AND b.client_id = ?
    """, (booking_id, g.client_id)).fetchone()
    if not booking:
        return error_response("not_found", "Бронь не найдена", 404)
    return jsonify(dict(booking))


@app.route('/api/bookings/<booking_id>/cancel', methods=['POST'])
@require_auth
def cancel_booking(booking_id):
    db = get_db()
    with db:
        booking = db.execute("SELECT * FROM bookings WHERE id = ? AND client_id = ?", (booking_id, g.client_id)).fetchone()
        if not booking:
            return error_response("not_found", "Бронь не найдена", 404)
        if booking['status'] != 'active':
            return error_response("already_cancelled", "Бронь уже отменена", 409)
        slot = db.execute("SELECT * FROM slots WHERE id = ?", (booking['slot_id'],)).fetchone()
        if as_utc(slot['start_at']) <= utcnow():
            return error_response("slot_started", "Заезд уже начался", 422)
        now = utcnow()
        time_left = as_utc(slot['start_at']) - now
        if time_left >= timedelta(hours=2):
            new_status = 'cancelled'
            db.execute("UPDATE slots SET free_karts = free_karts + ?, free_helmets = free_helmets + ? WHERE id = ?",
                       (booking['karts_count'], booking['rental_count'], booking['slot_id']))
        else:
            new_status = 'late_cancel'
        db.execute("UPDATE bookings SET status = ?, cancelled_at = ? WHERE id = ?", (new_status, now, booking_id))
    updated = db.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    return jsonify(dict(updated))


# ---------- Health & Static ----------
@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5000)