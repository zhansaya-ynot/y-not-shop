# DHL Express — отправка международного заказа

> **Когда применять:** заказ с адресом **за пределами UK**. Стоимость доставки **оплатил покупатель** на checkout (рассчитывается через DHL API в момент оформления заказа). Сервис — DHL Express WorldWide, **DDP** (duties paid by sender — таможенные сборы оплачены отправителем, покупатель ничего не доплачивает на таможне).
>
> **Аккаунт:** `230200799` (SHIPPER, DDP-capable). **Origin:** SW7 5QG (London).
>
> **Сколько занимает:** ~5 минут на заказ + время на customs declaration.

---

## Чек-лист "перед стартом"

- [ ] DHL Express аккаунт `230200799` активен, оплата привязана
- [ ] У тебя есть **термопринтер 4×6"** (или A4 принтер — DHL waybill 4 страницы, нужен лоток)
- [ ] **Customs invoice** заранее подготовлен (либо генерится автоматически через API)
- [ ] Знаешь **HS-код** товара (Harmonized System code — нужен для customs). Для кожаных курток обычно `4203100090`
- [ ] **Country of origin** товара — UK или Turkey (зависит от партии). Должно быть прописано в карточке товара

---

## Сценарий

### Шаг 1. Открой международный заказ
1. Заходи в `https://ynotlondon.com/admin/orders`.
2. Фильтр сверху → **Ship country** → выбери **не GB** (US, FR, DE и т.д.).
3. Найди заказ со статусом `PAID`.
4. Нажми на номер заказа.

### Шаг 2. Сверь shipping details
В блоке Order info наверху:
- **Carrier** должно быть `DHL`
- **Ship country** — целевая страна (например `US`)
- **Shipping cost** — что заплатил покупатель за DHL (например, `£42.50`)

В секции **Shipments**:
- `DHL · <AWB-номер>` (AWB = Air Waybill, 10-значный)
- **Label:** дата создания

> ✅ Этикетка + commercial invoice уже сгенерены автоматически. Жми "Print & despatch".
>
> ❌ Если ошибка → [Что делать если DHL API упал](#что-делать-если-dhl-api-упал) ниже.

### Шаг 3. Печать DHL Waybill + Customs Invoice
1. Нажми **"Print & despatch"** на странице заказа.
2. Откроется PDF — это **4 страницы**:
   - Стр. 1: **Air Waybill** (этикетка со штрихкодом — клеится на коробку)
   - Стр. 2–3: **Commercial Invoice** (3 копии — две в пластиковый файл-карман, одна в коробку)
   - Стр. 4: **Origin declaration** (если страна-получатель требует)
3. `⌘+P` → A4 → **Print**.

> 💡 У DHL пластиковые карманы-конверты ("waybill pouches"). Каждое отделение DHL выдаёт пачку бесплатно — попроси у курьера в первый pickup.

### Шаг 4. Упакуй
1. Положи товар в коробку с защитой (тишью YNOT, бирка благодарности, упаковочная бумага).
2. **Внутрь коробки** вложи 1 копию Commercial Invoice (на случай если внешний конверт оторвётся).
3. **Снаружи коробки**:
   - Air Waybill — приклей на самую большую грань
   - 2 копии Commercial Invoice — в waybill pouch (прозрачный карман), приклей рядом с этикеткой
4. Если страна требует Origin declaration — тоже в pouch.

### Шаг 5. Pickup или drop-off

**Вариант A — DHL Pickup (рекомендую):**
1. Зайди в `https://mydhl.express.dhl/gb/en/auth/login.html`
2. Login → **Schedule a Pickup**.
3. Укажи AWB номер (из шага 2), адрес отгрузки, временное окно.
4. Курьер приедет в указанное время, заберёт коробку.

**Вариант B — DHL ServicePoint:**
1. Найди ближайший: https://locator.dhl.com/
2. Отнеси коробку сама. Сотрудник отсканирует AWB.

### Шаг 6. Отметь как отгруженное
**После** реальной передачи коробки:

1. На странице заказа жми **"Print & despatch"** (если ещё не на ней).
2. Блок **Mark as despatched** → галочка → **"Mark as despatched"**.

Что произойдёт:
- Статус → **IN_TRANSIT**
- Email покупателю с AWB номером + ссылкой на трекинг DHL (`https://www.dhl.com/gb-en/home/tracking.html?tracking-id=<AWB>`)

---

## Что увидит покупатель

```
Subject: Your YNOT London order has shipped — DHL Express
From: hello@ynotlondon.com
Reply-To: zhansaya@ynotlondon.com

Hi <name>,
Your order #<order-number> is on its way via DHL Express WorldWide.
Tracking number (AWB): <AWB>
Track it: https://www.dhl.com/gb-en/home/tracking.html?tracking-id=<AWB>

Expected delivery: 2–4 business days.
Duties and taxes are already paid — you won't be asked for anything at customs.
```

---

## Что делать если DHL API упал

### Вариант A — Retry автоматически
3 retry с экспоненциальным backoff. Подожди ~10 минут.

### Вариант B — Manual через MyDHL portal
1. Зайди в **MyDHL** → **Create a shipment**.
2. Заполни вручную:
   - Sender: твой адрес (London SW7 5QG)
   - Receiver: адрес покупателя (скопируй из карточки заказа)
   - **Account**: `230200799` (DDP)
   - **Service**: Express WorldWide
   - **HS code**: `4203100090` (кожаные изделия)
   - **Country of origin**: UK или Turkey
   - **Declared value**: цена товара из заказа (без shipping)
3. Distribute → получишь PDF Waybill + Invoice → распечатай.
4. В админке YNOT → блок **Manual label upload**:
   - Shipment: `DHL · <id>`
   - Tracking number: **AWB номер из MyDHL** (10 цифр)
   - Choose file: PDF с waybill
   - **Upload manual label**
5. Дальше как обычно с шага 3.

---

## Customs declaration — что писать

| Поле | Значение | Откуда взять |
|------|----------|--------------|
| Description of goods | `Leather jacket — women's outerwear` | Карточка товара |
| HS code | `4203100090` (или специфичный для категории) | https://www.gov.uk/trade-tariff |
| Country of origin | UK или TR (Turkey) | Карточка товара поле `originCountry` |
| Declared value | Стоимость товара (без shipping) | Заказ → Items → sum |
| Currency | GBP | Всегда |
| Reason for export | `Sale` | Всегда (это коммерческая продажа, не подарок) |
| Incoterm | **DDP** (Delivered Duty Paid) | Всегда — покупатель НЕ должен платить на таможне |

> ⚠ **Очень важно — Incoterm DDP.** Если случайно указать DAP или DDU, покупатель получит счёт от таможни в своей стране и будет ругаться. Все наши тарифы и DHL аккаунт настроены на DDP — таможню оплачивает YNOT.

---

## Запрещённые направления

DHL не доставляет в ряд стран — на checkout мы должны их блокировать. **Если заказ всё же прошёл** (баг!) и страна в списке — нажми **Cancel + refund** на странице заказа, не пытайся отправить.

Запрещённые / проблемные:
- Россия (санкции)
- Беларусь (санкции)
- Иран, Северная Корея, Сирия (санкции)
- Некоторые отдалённые острова (логистика)

Полный список — `https://www.dhl.com/gb-en/home/customer-service/international-shipping/dhl-export-services.html`.

---

## Частые ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| AWB генерится но без Commercial Invoice | Карточка товара без HS-кода / country of origin | Заполни в админке `/admin/catalog/products/<id>`, retry |
| Курьер отказался забрать | Этикетка плохо приклеена / неверный pouch | Переупакуй, перевызови pickup |
| Покупатель пишет что попросили заплатить duties | Случайно отгрузили DAP вместо DDP | Звони в DHL Customer Service, объясни — обычно возвращают деньги клиенту |
| Tracking показывает "Held by Customs" >3 дней | Не хватает документов или странная декларация | Звони в DHL +44 844 248 0844 с AWB |
| Заказ отменили после генерации AWB | Покупатель передумал | Cancel в админке + **обязательно отмени AWB в MyDHL** (иначе DHL выставит счёт за неиспользованный label) |
