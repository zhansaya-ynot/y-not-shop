# YNOT Admin — инструкция

Гайд для повседневной работы в админ-панели YNOT London. Открывай через
`https://staging.ynotlondon.com/admin` (после launch — `https://ynotlondon.com/admin`).
Доступ только у пользователей с ролью `ADMIN` или `OWNER`.

---

## Содержание

1. [Вход](#1-вход)
2. [Dashboard (Overview)](#2-dashboard-overview)
3. [Orders — все заказы](#3-orders--все-заказы)
4. [Order detail — карточка заказа](#4-order-detail--карточка-заказа)
5. [Royal Mail: manual label flow](#5-royal-mail-manual-label-flow)
6. [Returns — возвраты](#6-returns--возвраты)
7. [Customers — клиенты](#7-customers--клиенты)
8. [Catalog — Products](#8-catalog--products)
9. [Catalog — Categories](#9-catalog--categories)
10. [Catalog — Inventory](#10-catalog--inventory)
11. [Content (CMS)](#11-content-cms)
12. [Marketing — Promo codes](#12-marketing--promo-codes)
13. [Shipping — Zones](#13-shipping--zones)
14. [Shipping — Preorder batches](#14-shipping--preorder-batches)
15. [Если что-то пошло не так](#15-если-что-то-пошло-не-так)

---

## 1. Вход

1. Открой `/admin` или `/sign-in`.
2. Введи свой email (`zhansaya@...`) и пароль.
3. Если ввела всё правильно — попадёшь на Overview. Если нет — увидишь "Invalid credentials".

Если забыла пароль — пиши Батырбеку, сделаем reset вручную (форма "Forgot
password" пока не реализована).

---

## 2. Dashboard (Overview)

`/admin` — главная страница админки, твой "первый экран дня".

### KPI tiles (верхний ряд, 7 плиток)

| Плитка | Что показывает |
|---|---|
| **Revenue today** | Сумма выручки за сегодня (UTC) |
| **Revenue this week** | За текущую неделю (с понедельника) |
| **Revenue this month** | За текущий месяц |
| **Orders today** | Кол-во заказов сегодня |
| **Orders this week** | Кол-во за неделю |
| **AOV (this month)** | Средний чек за месяц = revenue / orders |
| **Outstanding shipments** | Заказы оплачены но не отправлены — клик ведёт на `/admin/orders?status=NEW` |

Выручка считается **только по оплаченным** заказам (исключая `CANCELLED`,
`PAYMENT_FAILED`, `PENDING_PAYMENT`).

### Recent orders (10 последних)

Список последних 10 заказов. Колонки: order #, customer, total, status,
дата. Клик ведёт на `/admin/orders/[id]`.

### Top products this month (топ-5)

Самые продаваемые товары текущего месяца по выручке. Помогает понять что
сейчас "горит".

---

## 3. Orders — все заказы

`/admin/orders` — список всех заказов магазина. Сверху фильтры:

| Фильтр | Что делает |
|---|---|
| Search | Поиск по номеру заказа (`YN-2026-00013`) или email клиента |
| Status | NEW / PROCESSING / SHIPPED / DELIVERED / RETURNED / CANCELLED и т.д. |
| Carrier | ROYAL_MAIL или DHL |
| Date | От / до |

**Фильтры применяются мгновенно** — кнопку "Filter" жать не надо. Очистить
все фильтры — пустые значения. Параметры сохраняются в URL (можно скинуть
ссылку коллеге).

Колонки таблицы: номер, дата, клиент, статус, carrier, total. Клик по
строке открывает карточку заказа.

---

## 4. Order detail — карточка заказа

`/admin/orders/[id]` — основной экран работы с заказом. Состоит из:

### Customer
Имя, email, адрес доставки. Если адрес содержит кириллицу — это редкий
edge case, скажи разработчику.

### Items
Список товаров: название, размер, qty, unit price, line total, общий total.
Если заказ pre-order — рядом со строкой будет тэг `[preorder]`.

### Shipments
Каждый Shipment отображает:
- carrier (Royal Mail / DHL)
- tracking number (или "no tracking")
- даты: label generated, shipped, delivered
- если есть ошибки carrier API — красным `1 attempt(s): <error>`

### Banner про возврат
Если клиент попросил возврат — наверху появится **жёлтый банер** с
номером возврата (`RT-2026-00001`) и кнопкой "Open return →". Клик
ведёт на `/admin/returns/[id]` где ты делаешь inspection.

### Actions
**FULFILMENT (левая колонка):**
- **Print & Despatch** — открывает страницу с PDF label в iframe; Cmd+P → A4 → готово к отправке
- **Retry label** — повторно дёрнуть carrier API. Используй если предыдущая попытка завершилась с ошибкой (429, transient)
- **Manual label override** — *основной flow для Royal Mail на нашем тарифе* (см. §5)
- **Update tracking** — для DHL/RM вручную ввести tracking number когда печатала label через carrier dashboard
- **Resend tracking email** — повторно отправить клиенту "Your order has shipped" письмо

**MONEY & LIFECYCLE (правая колонка):**
- **Partial refund** — выбираешь товары + qty, возвращает деньги через Stripe + email клиенту. Нужен confirm в модалке.
- **Cancel order** — *только пока заказ не отгружен* (NEW/PROCESSING). После SHIPPED кнопка disabled, hover показывает почему. Если уже доставлено — используй Returns flow.

### Returns (внизу)
Если по этому заказу были возвраты — список с returnNumber, статусом,
позициями, причиной, датой запроса. Клик ведёт на `/admin/returns/[id]`.

### Refunds
История refund'ов: сумма, причина, дата. Создаются автоматически при
Partial refund / Approve return.

### Status history
Хронология статусов с временными метками — полезно когда клиент пишет
"когда у меня поменялся статус".

---

## 5. Royal Mail: manual label flow

⚠️ **Важно**: текущий тариф Click & Drop **не включает API-печать label**.
Поэтому полный automatic flow для Royal Mail не работает — нужны два
ручных шага. Для DHL всё автоматом, не паримся.

### Шаг 1: заказ создан в RM (автоматически)
Когда клиент оплатил UK-заказ:
- Наша система создала order в Click & Drop через API
- В админке shipment имеет `trackingNumber = <RM order ID>`
- Сообщение: `Click & Drop label API not enabled... Print from RM dashboard`

### Шаг 2: распечатать label на royalmail.com
1. Зайди на [business.parcel.royalmail.com](https://business.parcel.royalmail.com)
2. Меню **Orders** → **Orders ready to print**
3. Найди заказ по нашему номеру (`YN-2026-XXXXX`) — он появится в списке
4. Кликни **Print labels** → распечатай PDF

После печати в RM:
- C&D автоматически назначит **настоящий tracking number** (вида `AB123456789GB`)
- Помечает заказ как "Manifested"

### Шаг 3: загрузить label в нашу админку
1. Скачай PDF label (или сохрани при печати)
2. В нашей админке на странице заказа найди блок **"Manual label override"**
3. Загрузи PDF + впиши **настоящий tracking number** из C&D
4. **Save manual label** — клиенту автоматически уйдёт письмо с tracking
5. Кнопка **Print & Despatch** теперь активна — можешь распечатать ещё раз если нужно
6. После отгрузки — **Mark as despatched** в той же странице → status SHIPPED

### Если апгрейд тарифа RM — flow сразу станет автоматом
Скажи Батырбеку если хочешь — обсудим upgrade на Click & Drop с API
labels (~£5–10/мес сверху). Тогда шаги 2 и 3 не нужны: после оплаты сразу
будет PDF в нашей админке + tracking автоматом.

---

## 6. Returns — возвраты

`/admin/returns` — список всех возвратов от клиентов. Статусы:
- `REQUESTED` / `AWAITING_PARCEL` / `RECEIVED` — в работе
- `APPROVED` — refund выдан
- `REJECTED` — отклонён (с причиной)
- `CANCELLED` — клиент отменил

### Inspection (`/admin/returns/[id]`)

Когда клиент прислал посылку обратно и ты её осмотрела:

1. По каждой позиции отметь **Accept** или **Reject** (radio)
2. **Inspection notes** — заметки про состояние товара (необязательно при
   полном accept, обязательно при reject)
3. **Rejection reason** — обязательно если reject хотя бы один товар

Дальше:
- **Approve & refund** — открывает confirm dialog "Approve N items and refund?".
  После confirm — Stripe refund на сумму approved items, email клиенту,
  order.status → RETURNED
- **Reject** — confirm dialog, отправляет клиенту email с rejection reason

После approve/reject статус возврата меняется на финальный — повторно нажать
кнопки нельзя.

---

## 7. Customers — клиенты

`/admin/customers` — список всех клиентов магазина.

### Список

Колонки: name, email, role (CUSTOMER / ADMIN / OWNER), # orders, lifetime
spend, joined date, last order date.

Фильтры (real-time, без кнопки Filter):

| Фильтр | Что делает |
|---|---|
| Search | Поиск по имени или email |
| Role | Фильтр по роли |
| Hide guests | Скрыть guest-checkout без зарегистрированного аккаунта |

Lifetime spend считается **без** учёта `CANCELLED`, `PAYMENT_FAILED`,
`PENDING_PAYMENT` — это реальные деньги от клиента.

### Карточка клиента (`/admin/customers/[id]`)

- **Имя, email, role badge, guest indicator** (если `isGuest: true`)
- **Stats card row** (4 плитки):
  - Total orders
  - Lifetime spend
  - Average order value
  - Returns count
- **Order history** — таблица всех заказов клиента, клик ведёт на `/admin/orders/[id]`
- **Address book** — все адреса доставки, по которым клиент когда-либо
  получал заказы (deduplicated по line1+postcode)

Используй когда клиент пишет "не пришла посылка" / "сделай скидку как
лояльному" — сразу видишь его историю.

---

## 8. Catalog — Products

`/admin/catalog/products` — список товаров. Колонки: photo, name, slug,
status, price.

### Карточка товара (`/admin/catalog/products/[id]`)

Поля:
- **Name** — отображается как заголовок товара
- **Slug** — URL `/products/<slug>` — будь осторожна при изменении (старые ссылки сломаются)
- **Description** — поддерживает markdown
- **Price (GBP cents)** — `72500` = £725.00 (сторим в центах чтобы избежать float-ошибок)
- **Status** — DRAFT / ACTIVE / ARCHIVED. Только ACTIVE отображается на сайте.
- **Images** — drag & drop или нажми "Upload"

### Customs / Shipping поля (важно для DHL и возвратов!)
- **HS code** — таможенный код товара. Для одежды обычно `4203100000` (кожа) или `6202900000` (ткань). Гугли "HS code [тип товара]" если не знаешь
- **Country of origin** — ISO-2 код страны производства (`IT`, `TR`, `PT`)
- **Weight (grams)** — реальный вес товара в граммах. Если не заполнить — система использует 500g по умолчанию

⚠️ Эти три поля **обязательно** заполни для каждого товара перед launch.
Иначе:
- DHL может отбить shipment как "incomplete"
- На CN23 (таможенная декларация для возвратов из не-UK) будет прочерк → таможня может задержать посылку

### Variants
Каждый product имеет варианты по размеру (S/M/L/XL). Для каждого размера —
свой stock. Изменения сохраняются автоматически после клика "Save".

---

## 9. Catalog — Categories

`/admin/catalog/categories` — категории навигации (Outerwear, Knitwear и т.д.).

Можно:
- создавать новые категории
- менять название и описание
- ставить hero image
- драг-н-дроп для сортировки

Каждый product может быть в нескольких категориях.

---

## 10. Catalog — Inventory

`/admin/inventory` — bulk-управление stock'ом по всем variant'ам без захода
в каждую карточку товара.

### Сетка

Каждая строка = один variant (product × size).
Колонки: photo, product name, size, current stock, low-stock badge.

**Low-stock badge** появляется когда stock ≤ 5 — оранжевый pill, чтобы
сразу видеть что заканчивается.

### Inline-edit stock

1. Кликни на число в колонке Stock → поле становится editable
2. Введи новое значение → Tab / Enter / клик вне поля → автосохранение
3. Toast подтверждает: "Stock updated to N"
4. Esc — отменить редактирование

Защита: отрицательные числа и не-целые значения отбиваются на сервере с
ошибкой (toast красный).

### Фильтры

- **Search** — по имени продукта
- **Show only low stock** — показать только варианты ≤ 5

### Когда использовать

- Понедельник утром: Open inventory + filter "low stock" → составить
  заявку на пополнение
- Получили партию товара: открыть один раз и проставить новые stock
  числа списком, без переходов между карточками продуктов

---

## 11. Content (CMS)

Управление статическим контентом сайта. Сохранение через "Save" в каждой
секции — после save изменения сразу на сайте.

| Раздел | Что управляет |
|---|---|
| **Hero** | Главный баннер на homepage (заголовок, подзаголовок, CTA, фон) |
| **Announcements** | Чёрная полоса сверху ("FREE UK SHIPPING" и т.п.) |
| **Lookbook** | Сетка фоток lookbook'а на homepage |
| **Pages** | Статические страницы (Our Story, Privacy Policy, Returns, Sustainability) — markdown |
| **Settings** | Глобальные настройки магазина (контактный email, телефон, social links, footer) |

---

## 12. Marketing — Promo codes

`/admin/marketing/promos` — управление промокодами.

Поля промо:
- **Code** — то что вводит клиент (`WELCOME10`, `BLACKFRIDAY` и т.п.)
- **Discount type** — percent / fixed amount
- **Discount value** — `10` для 10% или `5000` для £50 в центах
- **Min order value** — минимальная сумма заказа (опционально)
- **Max uses** — общий лимит использований (null = без лимита)
- **Max uses per customer** — на одного клиента (обычно `1`)
- **Valid from / to** — даты начала и конца акции
- **Active** — toggle: можно временно выключить без удаления

Промокод применяется на странице корзины и /checkout/payment.

---

## 13. Shipping — Zones

`/admin/shipping/zones` — управление зонами доставки.

Каждая Zone имеет:
- Название (United Kingdom, European Union, Worldwide)
- Список стран (52 чекбокса с фильтром)
- Привязанные методы доставки (Royal Mail / DHL)
- Estimated delivery days (min/max)

⚠️ Не отключай зоны без обсуждения — это сломает checkout для клиентов из этих
стран.

---

## 14. Shipping — Preorder batches

`/admin/preorders` — управление партиями pre-order товаров.

Когда клиент покупает товар со статусом "pre-order", его item автоматически
попадает в **batch** (партию). Каждая batch:
- Имеет lead time (обычно 4 недели)
- Имеет shipping window (обычно 2 недели после lead)
- Статусы: `PENDING` → `RECEIVED` → `SHIPPING` → `COMPLETED`

### Когда товар прибыл на склад
1. Открой нужный batch
2. Кликни **Release for shipping**
3. Confirm → система создаст Shipment по каждому ордеру в batch'е
4. Статус batch'а меняется на `SHIPPING`

После этого все pre-order заказы в этой batch'е работают как обычные ордера —
печатаешь label / Manual label override → отправляешь.

Если что-то пошло не так с конкретными ордерами — **Retry** на batch
повторно создаст shipments только для тех что упали.

---

## 15. Если что-то пошло не так

### Сайт не открывается
1. Зайди на [Cloudflare](https://dash.cloudflare.com) → DNS — проверь что A-record указывает на `13.135.247.31`
2. Если CF упал — отключи proxy (нажми оранжевое облако чтобы стало серым)
3. Если упал сервер — пиши Батырбеку, у него SSH

### Stripe деньги застряли / refund не прошёл
1. [Stripe Dashboard](https://dashboard.stripe.com) → Payments → найди по сумме / customer email
2. Если в нашей админке refund успешный а в Stripe нет — пиши Батырбеку (значит webhook не прошёл)

### Royal Mail "Forbidden" / "Service code not found"
- Скрин ошибки в чат + номер заказа — вероятно нужен апгрейд тарифа или
  другой service code в env

### Email клиенту не пришёл
1. [Resend dashboard](https://resend.com/emails) → search by recipient email
2. Если статус `bounced` — у клиента невалидный email
3. Если статус `delivered` — попроси клиента проверить spam
4. Если письма вообще нет в Resend — пиши Батырбеку (значит worker не отправил)

### Order залип в `PENDING_PAYMENT`
- Клиент не довёл оплату до конца → автоматически отменится через 24 часа
- Или клиент может вернуться через `/checkout/resume/[id]` (мы дали ему
  ссылку в email "Complete your payment")

### Я что-то случайно нажала и не уверена что правильно
- Большинство действий имеют confirm dialog — если не нажала "Confirm" в модалке, ничего не произошло
- Refund / Cancel / Approve return — необратимы, но Refund можно сделать ещё раз (хоть и плохо)
- Pages content / Promo codes — можно вернуть к предыдущему значению (только вручную, истории нет)
- В сомнениях — пиши Батырбеку до подтверждения

---

## Контакты

- Технические вопросы / баги — Батырбек
- Бизнес-вопросы (markdown contracts, контент) — основатели

---

*Версия гайда: 1.0 · 2026-05-07*
