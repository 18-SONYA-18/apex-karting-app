
# День 1 — Анализ · «Апекс»

Артефакты аналитика по сквозному проекту летней школы. Структура повторяет
классический процесс работы аналитика: от входа заказчика до ТЗ, которое
передаётся в **День 2** разработчику.

## Маршрут по этапам

| Этап | Папка | Что внутри |
| :-- | :-- | :-- |
| **Вход** | [0-customer-brief/](0-customer-brief/) | [customer-brief.md](0-customer-brief/customer-brief) — сырой бриф заказчика (заполнен) |
| **1. Выявление требований** | [1-elicitation/](1-elicitation/) | [customer-questions.md](1-elicitation/customer-questions), [domain-description.md](1-elicitation/domain-description) |
| **2. Описание требований** | [2-requirements/](2-requirements/) | [business](2-requirements/business-requirements) · [functional](2-requirements/functional-requirements) · [non-functional](2-requirements/non-functional-requirements) · [user-stories](2-requirements/user-stories) · [use-cases](2-requirements/use-cases) |
| **Бриф для дизайна** | [3-design-brief/](3-design-brief/) | [design-brief.md](3-design-brief/design-brief.md) — требования для UI/UX дизайнера |
| **3. Проектирование** | [4-design/](4-design/) | [data-model.md](4-design/data-model), [api-sequence.md](4-design/api-sequence) |
| **4. ТЗ** | [5-mobile-app-spec/](5-mobile-app-spec/) | [README.md](5-mobile-app-spec/README.md) — детальное ТЗ по экранам и логикам |
| **API (OpenAPI)** | [api/](api/) | [redocly.yaml](api/redocly.yaml) — многофайловый OpenAPI (домены: auth, slots, bookings, profile, marshals) |

## Дополнительно (подготовка к лекции)

- [prompts/](prompts/) — [хорошие](prompts/good-prompts.md) и [плохие](prompts/bad-prompts.md) промпты для демо.
- [checklists/](checklists/) — [чек-лист цифровой гигиены](checklists/digital-hygiene-checklist.md) перед передачей в разработку.

## Статус

✅ **Все артефакты заполнены и готовы к передаче в разработку.**

**Структура проекта «Апекс»:**
- Бриф заказчика — заполнен
- Выявление требований — завершено (вопросы заказчику, описание домена)
- Описание требований — завершено (BR, FR, NFR, user stories, use cases)
- Дизайн-бриф — завершён (14 экранов/шторок + foundations + design-review)
- Проектирование — завершено (модель данных, sequence-диаграмма API)
- ТЗ — завершено (11 экранов/шторок + 8 переиспользуемых логик + feature-list)
- API — многофайловый OpenAPI (домены: auth, slots, bookings, profile, marshals)

**Ключевые решения:**
- Офлайн-оплата (наличные/перевод), онлайн-оплата — Phase 2
- Только роль «Клиент» в приложении, маршалы и владелец — через существующую админку
- Лимит мест на бронь: 4 (себя + до 3 гостей)
- Правило 2 часов для отмены (≥2ч — ранняя, <2ч — поздняя)
- Два независимых лимита: места и прокатная экипировка
- Идемпотентность `createBooking` через `Idempotency-Key` (R-022)

**API:** спецификация переведена на многофайловый формат OpenAPI (Redocly) —
реестр доменов в [api/redocly.yaml](api/redocly.yaml); устаревший единый
`api/openapi.yaml` больше не используется. Контракты доработаны по QA-ревью.

> **Передача в День 2:** итоговые требования + модель данных + API-спецификация + ТЗ.

