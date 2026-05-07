# Royal Mail — переход на полную автоматизацию

Технический док для оператора (Батырбек) — что именно нужно сделать
чтобы убрать ручной шаг с печатью label на сайте RM и upload PDF в нашу
админку. После выполнения шагов ниже UK-заказы будут работать так же
как DHL: оплата → автогенерация label PDF → автоотправка email с
tracking → admin печатает прямо из нашей админки.

---

## Текущее состояние

| Что работает автоматом | Что вручную |
|---|---|
| `RoyalMailFreeProvider` quote (£0 для UK на checkout) | — |
| `POST /orders` — создание заказа в Click & Drop | — |
| Получение `orderIdentifier` от RM API | — |
| Сохранение rmOrderId в `Shipment.trackingNumber` | — |
| — | **Печать label на сайте RM** ([business.parcel.royalmail.com](https://business.parcel.royalmail.com)) |
| — | **Upload PDF в нашу админку** через `Manual label override` |
| — | **Ввод реального tracking number** из C&D в наш UI |

Корень: `GET /orders/<id>/label` возвращает **HTTP 403 "Feature not
available"** — на нашем тарифе Click & Drop программный доступ к label
PDF не входит. Код корректно отлавливает это (см.
`src/server/shipping/royal-mail-click-drop.ts` →
`RoyalMailLabelApiUnavailableError`) и переключается на manual-flow.

---

## Путь №1 — апгрейд Click & Drop (рекомендую)

### Что делать

1. Зайти на [business.parcel.royalmail.com](https://business.parcel.royalmail.com)
2. Settings → Subscriptions / Plan → выбрать тариф с **API Label Generation**
   - Раньше это шло как отдельный add-on ("Click & Drop with API & Print")
   - Сейчас иногда продают как "Click & Drop Plus" — спросить sales
   - Звонок в Royal Mail Business Customer Services: **0345 266 7820**
3. Стоимость: **~£5–15/мес сверху** (зависит от объёма; до 100 parcel/мес —
   нижняя граница)
4. После активации — в нашем коде ничего менять не нужно. `getLabel`
   автоматом начнёт возвращать PDF вместо 403.

### Что произойдёт после апгрейда

```
[Customer pays] → [POST /orders → orderIdentifier]
                → [GET /orders/<id>/label?documentType=postageLabel] ✅
                → [Save labelPdfBytes via deps.storage.put]
                → [Save trackingNumber + labelGeneratedAt]
                → [Email: "Your order has shipped" with tracking link]

[Admin opens order] → [Print & Despatch button → iframe with PDF]
                    → [Mark as despatched → status SHIPPED]
```

Manual label override остаётся как fallback, но в нормальном flow не нужен.

---

## Путь №2 — Royal Mail OBA (Online Business Account)

### Когда выбирать
- Объём **>50 parcel/неделю** или **>200/месяц**
- Хочется лучшие тарифы (~£1.50–2.00 за parcel вместо £2.85 на C&D)
- Нужна возможность account credit / monthly invoicing

### Что делать
1. Контакт Royal Mail Business Sales — **enquiry form** на royalmail.com/business
2. Open OBA application — нужна:
   - Регистрационная информация YNOT London Ltd
   - Estimated annual volume
   - Выбрать схему (например Tracked 24 / Tracked 48)
3. Дождаться approval (обычно 1-2 недели)
4. Получить **OBA account number** + production API credentials

### Что менять в коде после OBA

- Перейти с Click & Drop API на OBA Shipping API (`https://api.royalmail.net`)
- Переписать `RoyalMailClickDropProvider` → `RoyalMailObaProvider`
- Возможно сменить схему авторизации (OBA использует client_id/client_secret + token endpoint)
- Заполнить `ROYAL_MAIL_OBA_*` env vars

Это **большая** правка. Делать только если объёмы реально оправдывают.

---

## Путь №3 — третья сторона (e.g. ShipStation, Sendcloud, Royal Mail e-Loop)

### Когда выбирать
- Уже хочется multi-carrier (RM + DHL + DPD + Yodel) под одним API
- Нужны автоматические rate-shopping / cheapest carrier per parcel

### Что делать
1. Подписка на ShipStation / Sendcloud (~£20-50/мес)
2. Привязать аккаунты RM + DHL внутри их dashboard
3. В нашем коде: добавить новый shipping provider, который ходит к ShipStation API
4. Все carrier-specific нюансы (auth, format, tracking sync) на стороне аггрегатора

Тоже большой объём работы — оправдано если планируется масштабироваться.

---

## Чек-лист после Пути №1 (апгрейд C&D)

- [ ] Активирован тариф с API labels на business.parcel.royalmail.com
- [ ] Подтверждение в email с RM что feature включена
- [ ] Сделать тестовый UK заказ через staging (Stripe test card)
- [ ] Открыть admin → Order detail → нажать "Retry label" если shipment
      ещё в `attemptCount > 0`
- [ ] Проверить что:
  - В Shipments секции исчезло сообщение "Click & Drop label API not enabled"
  - Появился реальный `trackingNumber` (формат `AB123456789GB`)
  - `labelGeneratedAt` заполнен
  - Кнопка `Print & Despatch` показывает PDF в iframe
  - Клиенту на email пришло "Your order has shipped" с tracking link
- [ ] Обновить §14 в `docs/admin-guide-ru.md` — убрать manual-flow
      инструкции для Жансаи, заменить на "просто жми Print & Despatch"

---

## Smoke test после активации

```bash
# 1. Создать UK тестовый ордер через staging
curl -X POST https://staging.ynotlondon.com/api/checkout/create \
  -H "Content-Type: application/json" \
  -d '{
    "address": {
      "email": "test+rm@ynotlondon.com",
      "firstName": "Test", "lastName": "User",
      "line1": "10 Downing Street", "city": "London",
      "postcode": "SW1A 2AA", "countryCode": "GB",
      "phone": "+44 20 0000 0000"
    },
    "methodId": "<royal_mail_method_id>"
  }'

# 2. Оплатить через Stripe test card 4242 4242 4242 4242

# 3. Проверить shipment row
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo docker exec ynot-postgres psql -U ynot -d ynot_prod -c \
  "SELECT id, carrier, \"trackingNumber\", \"labelGeneratedAt\", \"lastAttemptError\"
   FROM \"Shipment\" ORDER BY \"createdAt\" DESC LIMIT 1;"'

# 4. Скачать label через нашу админку и сверить с тем что в C&D dashboard
```

Если всё работает — `lastAttemptError = NULL`, `labelGeneratedAt` заполнен,
trackingNumber выглядит как `AB123456789GB`.

---

## Что НЕ нужно делать

- ❌ Менять `Authorization: Bearer` на что-то другое — текущий формат
  правильный (`ApiKey` возвращает 401)
- ❌ Менять service code `TOLP48` — он подходит под наш тариф для
  Tracked 48
- ❌ Хардкодить tracking number — RM назначает его при manifest
- ❌ Удалять fallback `RoyalMailLabelApiUnavailableError` — он остаётся
  как safety-net на случай если subscription внезапно слетит

---

## Если не работает — алгоритм действий

Идём от самого вероятного к самому нудному. На каждом шаге смотришь
**красную надпись в админке** под Shipments (`lastAttemptError`) — она
расскажет что именно RM прислал.

### Шаг 1. Что говорит ошибка?

Открой `/admin/orders/<id>` → блок Shipments → красная строка
`N attempt(s): <message>`. По шаблону сообщения сразу понятно куда копать:

| Текст ошибки | Причина | Куда смотреть |
|---|---|---|
| `Click & Drop label API not enabled on this tier` | Тариф ещё не апгрейднут | Шаг 2 |
| `403 Forbidden (Feature not available)` | То же самое, на API уровне | Шаг 2 |
| `401 Unauthorized` | API key неверный или отозван | Шаг 3 |
| `400 Service code 'XXX' could not be found` | Service code не подходит под subscription | Шаг 4 |
| `400 documentType parameter not provided` | Старый код, нужен redeploy | Шаг 7 |
| `no createdOrders — <ref>: <code> <message>` | RM отбил order по валидации (адрес/вес/постcode) | Шаг 5 |
| `5xx` или timeout | Падение на стороне RM | Шаг 6 |

### Шаг 2. Подтвердить апгрейд тарифа

1. Зайти на business.parcel.royalmail.com → Settings → Subscriptions
2. Проверить активный план — должна быть строка про **API Label
   Generation** или **API & Print**
3. Если нет — звонить **0345 266 7820**, попросить активировать
4. После активации **подождать 30 минут** (RM иногда кэширует флаги
   тарифа) → нажать **Retry label** в админке
5. Проверить новую ошибку (если она другая — переходим к её строке в
   таблице выше)

### Шаг 3. API key

```bash
# 1. Проверить что ключ в env совпадает с тем что в C&D dashboard
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo grep ROYAL_MAIL_API_KEY /etc/ynot/secrets.env'
```

Сверить с **Settings → Integrations → YNOT Fashion - API → Click & Drop
API authorisation key**. Если разные:

```bash
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo nano /etc/ynot/secrets.env'   # обновить ROYAL_MAIL_API_KEY=...
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo -u ynot bash -c "cd /srv/ynot && IMAGE_TAG=latest \
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
   --profile prod up -d --no-deps --force-recreate app ynot-worker"'
```

Если ключ был перевыпущен в RM dashboard (например после смены пароля)
— старый отозван, нужно вписать новый.

### Шаг 4. Service code

Зайти **Manual order entry** в C&D → Step 2 → раскрыть dropdown
"Postage service" → найти строку **Tracked 48** → посмотреть колонку
**Service code**.

Сейчас в env стоит `ROYAL_MAIL_SERVICE_CODE=TOLP48`. Если в dropdown
у тебя **другой** код (например `TPN48` / `TRN48` / `TKD48`) —
обновить:

```bash
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'echo "ROYAL_MAIL_SERVICE_CODE=<новый_код>" | sudo tee -a /etc/ynot/secrets.env'
# затем recreate worker (см. шаг 3)
```

Список услуг зависит от тарифа — после апгрейда коды могут измениться.

### Шаг 5. Validation error на адресе

Если `failedOrders[].errors[]` содержит `Invalid postcode` /
`Country mismatch` / `Weight required` — order payload не подходит.

```bash
# Посмотреть что именно мы отправили
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo docker logs ynot-worker --tail 200 | grep -A 20 "Royal Mail createShipment"'
```

Частые причины:
- **Postcode без пробела** (`SW1A2AA`) — RM хочет с пробелом (`SW1A 2AA`).
  Фикс: `src/server/shipping/royal-mail-click-drop.ts` → `partyToRm` →
  нормализовать postcode перед отправкой
- **Weight = 0** — продукт не имеет `weightGrams`. Заполнить в админке
  товара или поднять `DEFAULT_ITEM_WEIGHT_GRAMS` в
  `src/server/fulfilment/carrier.ts`
- **Phone слишком короткий** — RM хочет минимум 10 цифр. Проверить
  Order.shipPhone

### Шаг 6. RM API лежит

Проверить статус: [royalmail.com/business/help](https://royalmail.com/business/help)
или твиттер `@RoyalMailHelp`. Если incident — подождать, нажать Retry
позже. Worker сам ретраит до `attemptCount = 5` с экспоненциальным
бэкоффом (см. `src/worker/jobs/retry-failed-shipments.ts`).

### Шаг 7. Контейнер на старом коде

Проверить что running container содержит свежие фиксы:

```bash
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo docker exec ynot-app sh -c "grep -ro \"documentType=postageLabel\\|RoyalMailLabelApi\" /app/.next/server/ 2>/dev/null | head -3"'
```

Если ничего не вышло — image не последний. Force recreate:

```bash
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo docker pull ghcr.io/zhansaya-ynot/ynot-app:latest && \
   sudo -u ynot bash -c "cd /srv/ynot && IMAGE_TAG=latest \
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
   --profile prod up -d --no-deps --force-recreate app ynot-worker"'
```

### Шаг 8. Если всё проверено и не работает

Открыть RM API support ticket: на business.parcel.royalmail.com → Help →
Submit ticket → приложить:
- Точный текст ошибки из `lastAttemptError`
- `orderReference` (наш orderNumber)
- Время попытки (UTC)
- API key (последние 4 символа достаточно для идентификации)

Параллельно — fallback на Manual label override как раньше, чтобы клиенты
не висели без отправки.

### Логи в одном месте

Если хочется быстро посмотреть что worker делал за последние 30 минут:

```bash
ssh -i ~/.ssh/ynot-prod.pem ubuntu@13.135.247.31 \
  'sudo docker logs ynot-worker --since 30m 2>&1 | grep -iE "royal|shipment|error"'
```

---

## Связанные файлы

- `src/server/shipping/royal-mail-click-drop.ts` — клиент Click & Drop API
- `src/server/fulfilment/carrier.ts` — обработка `RoyalMailLabelApiUnavailableError`
- `src/server/env.ts` — `ROYAL_MAIL_API_KEY`, `ROYAL_MAIL_SERVICE_CODE`,
  `ROYAL_MAIL_RETURNS_SERVICE_CODE`
- `/etc/ynot/secrets.env` на VPS — production env vars
- `prisma/schema.prisma` → `Shipment.trackingNumber`, `labelStorageKey`,
  `labelGeneratedAt`, `lastAttemptError`

---

*Дата: 2026-05-08 · Версия: 1.0*
