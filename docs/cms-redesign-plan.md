# CMS redesign — audit & plan

Founder ask: сделать так, чтобы Жансая могла менять **весь** текст на сайте через админку, и редактировать в WYSIWYG (не «первая строка / вторая строка», а живая превью).

---

## 1. Что сейчас редактируемо vs захардкожено

### ✅ Уже в БД
| Сущность | Где хранится | Видно в админке |
|---|---|---|
| Homepage hero (image/video/eyebrow/CTA) | `HeroBlock` | `/admin/content/hero` |
| AnnouncementBar (бегущая чёрная строка) | `AnnouncementMessage` | `/admin/content/announcements` |
| Lookbook | `LookbookImage` | `/admin/content/lookbook` |
| Categories (имя, slug, banner, hero) | `Category` | `/admin/catalog/categories` |
| Products (всё) | `Product` | `/admin/catalog/products` |
| Promo codes | `PromoCode` | `/admin/marketing/promos` |
| Static pages body (markdown) | `StaticPage` | `/admin/content/pages` |
| Brand statement (3 строки) | `SitePolicy` | `/admin/content/settings` |
| Auth side-images | `SitePolicy` | `/admin/content/settings` |
| Contact email + WhatsApp | `SitePolicy` | `/admin/content/settings` |
| Page hero image (Our Story etc.) | `StaticPage.heroImage` | `/admin/content/pages` |

### ❌ Сейчас захардкожено в JSX
| Текст | Файл | Что именно |
|---|---|---|
| Footer About/Customer Care/Product/Follow заголовки + ссылки | `site-footer.tsx` | Всё |
| Our Story body (5 параграфов) | `our-story/page.tsx` | Параграфы + Value Callouts (4 шт) + Pull Quote |
| Contact: «Customer care», «Studio», «WhatsApp», «Press», их подписи | `contact/page.tsx` | Все блоки |
| Shipping & Returns: Delivery copy + ShippingTable rows + Returns bullets + preorder note | `shipping-returns/page.tsx` | Всё |
| Sustainability page: вся вёрстка | `sustainability/page.tsx` | 37 строк |
| Product Care page: вся вёрстка | `product-care/page.tsx` | 48 строк |
| Initiate return: заголовки шагов | `initiate-return/page.tsx` | Тексты шагов |
| WhatsApp widget tooltip | `whatsapp-widget.tsx` | Сообщения |
| Sign in / Register: title, subtitle, footer-link copy | `(auth)/sign-in`, `(auth)/register` | 4-5 строк |

---

## 2. Что не так с текущей админкой

- **Текст homepage расколот на 4 раздела**: Hero (отдельно), Announcements, Lookbook, Settings → Brand statement. Жансае надо лезть в 4 места чтобы поменять одну страницу.
- **«Pages»** — просто список markdown-страниц. Не покрывает homepage / страницы с нестандартным layout (Our Story с value callouts, Contact с 4 info-блоками).
- **Markdown редактор** — preview справа отдельно, нужно знать `**bold**`, `## h2` и т.д. Жансая не редактор-разработчик.

---

## 3. Предлагаемая архитектура

### Sidebar admin → один раздел **PAGES** (заменит CONTENT)

```
PAGES
  Home              ← Hero + Brand statement + Shop by Cat heading + Timeless + New Arrivals + Lookbook + Newsletter
  Our Story         ← Hero img + intro + Value Callouts + Pull Quote
  Contact           ← Hero + 4 info blocks + form text
  Shipping & Returns← Delivery copy + table + Returns copy + bullets + preorder note
  Privacy
  Sustainability
  Product Care
  Initiate Return   ← Step headlines

GLOBAL
  Header (announcement bar)
  Footer            ← Все ссылки и заголовки футера
  Auth (sign-in / register copy + images)

SETTINGS
  Storefront        ← currency, carrier, contact email, WhatsApp number, free-ship threshold
```

### Технически

- **Один `StaticPage` row на страницу** — расширим модель:
  - `slug: home | our-story | contact | shipping-returns | privacy | ...`
  - `heroImage: String?`
  - `blocks: Json` — массив структурированных блоков (см. ниже)
  - `metaTitle / metaDescription` (уже есть)

- **Blocks Json** — типизированный union на zod:
  ```ts
  type PageBlock =
    | { type: 'hero'; heading: string; subheading?: string; image: string }
    | { type: 'rich-text'; html: string }              // TipTap HTML
    | { type: 'value-callouts'; items: { title; body }[] }
    | { type: 'pull-quote'; quote: string; attribution: string }
    | { type: 'shipping-table'; rows: { destination; time; carrier; cost }[] }
    | { type: 'info-grid'; items: { title; body; href? }[] }   // for /contact
    | { type: 'bullets'; items: string[] }
  ```

- **WYSIWYG**: TipTap (10KB-ish, актуальный, есть готовые расширения).
  Заменяет текущий `MarkdownEditor`. На сохранении пишется **HTML**, рендер на storefront через `dangerouslySetInnerHTML` + sanitize.

- **Footer + AnnouncementBar** → отдельный `GlobalContent` singleton (column в SitePolicy ИЛИ свой row).

---

## 4. План реализации (порядок)

### Этап 1 — Инфраструктура (1 commit)
- [x] План в репо
- [ ] Установить `@tiptap/react` + базовые extensions (StarterKit + Link + Image + Underline)
- [ ] Создать `<RichTextEditor>` компонент с toolbar (B / I / U / H2 / H3 / list / link / clear)

### Этап 2 — Переход StaticPage на blocks (2 commits)
- [ ] Migration: добавить `blocks Json` на StaticPage
- [ ] Backfill: преобразовать `bodyMarkdown` в `[{type:'rich-text', html: marked(bodyMarkdown)}]`
- [ ] Render storefront через `<PageBlocks blocks={...} />` компонент
- [ ] Старый MarkdownEditor → новый BlockEditor с visual TipTap для rich-text блоков

### Этап 3 — Миграция страниц (1 commit на страницу)
- [ ] **Our Story** — preset из 4 блоков (hero / rich-text / value-callouts / pull-quote)
- [ ] **Contact** — info-grid (4 блока) + form
- [ ] **Shipping & Returns** — rich-text + shipping-table + bullets
- [ ] **Privacy / Sustainability / Product Care** — single rich-text block (но уже редактируется в TipTap)
- [ ] **Initiate Return** — отдельная small singleton (3 step labels)

### Этап 4 — Homepage в Pages (1 commit)
- [ ] Создать row `slug='home'` с blocks: hero + brand-statement + categories-section + timeless + new-arrivals + lookbook + newsletter
- [ ] Перенести Hero edit из `/admin/content/hero` → внутрь /admin/content/pages/home
- [ ] Старый /admin/content/hero оставить как redirect

### Этап 5 — Глобальные блоки (1 commit)
- [ ] Footer: новая модель `FooterColumn[]` или `SitePolicy.footerColumnsJson`
- [ ] AnnouncementBar messages редактирование (уже есть)
- [ ] Auth pages copy в SitePolicy (новые поля `signInTitle / signInSubtitle / registerTitle / registerSubtitle`)

### Этап 6 — Реорганизация sidebar (1 commit)
- [ ] Новые headings в `nav-sections.ts`: PAGES, GLOBAL, SETTINGS (как в плане выше)
- [ ] Удалить «CONTENT» хедер
- [ ] Старые URL-ы редиректят на новые

---

## 5. Что отложить (не сейчас)

- Email templates как HTML-редактор — пока в коде ок
- Многоязычность (EN / RU) — отдельная задача
- Версионирование контента (draft / publish) — нужен flow review, отложить
- A/B test разных hero — overkill для starting shop

---

## 6. Тайминг

- Этап 1 (TipTap инфраструктура): **30-45 мин**
- Этап 2 (blocks схема + миграция): **1.5-2 часа**
- Этап 3 (5 страниц по очереди): **2 часа**
- Этап 4 (Homepage в Pages): **1 час**
- Этап 5 (Footer + Auth): **45 мин**
- Этап 6 (sidebar): **15 мин**

**Итого: ~6 часов работы.** Каждый этап = отдельный коммит → можно прерваться в любой момент.

---

*Версия: 1.0 · 2026-05-08*
