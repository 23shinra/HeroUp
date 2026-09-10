# Cascade OTP API — полная инструкция для разработчика и AI-агентов

> **Как пользоваться этим файлом**
>
> 1. Скачай этот `.md` из кабинета Cascade.
> 2. Создай API-ключ в кабинете → **API-ключи**.
> 3. Положи файл в корень своего проекта (или в `docs/`).
> 4. Открой Cursor / Claude Code / Codex и вставь промпт из раздела ниже, подставив свой ключ.
> 5. Агент сам добавит клиент, env и вызовы `send` / `verify`.

**Сервис:** Cascade (OTP через WhatsApp / Telegram / SMS)  
**Кабинет:** https://otp.kztusdt.kz/cabinet  
**Базовый URL API:** `https://otp.kztusdt.kz/api`  
**OpenAPI:** https://otp.kztusdt.kz/openapi.yaml  
**HTML-документация:** https://otp.kztusdt.kz/docs  

---

## Промпт для Cursor / Claude Code / Codex

Скопируй целиком и замени `PASTE_API_KEY_HERE` на свой ключ:

```text
В этом проекте нужно подключить Cascade OTP API по документации из файла cascade-otp-integration.md (или docs/cascade-otp-integration.md).

Конфиг:
- BASE_URL = https://otp.kztusdt.kz/api
- OTP_API_TOKEN = PASTE_API_KEY_HERE
- Ключ храни только в .env / secrets, никогда во фронтенде и публичном репозитории.

Сделай:
1. Добавь OTP_API_TOKEN (и при необходимости OTP_API_BASE_URL) в .env.example и .env.
2. Реализуй маленький backend-клиент (на стеке этого проекта) с методами:
   - sendOtp(phone, purpose?, channel?, link?)
   - verifyOtp(phone, code, purpose?)
3. Вызывай API ТОЛЬКО с бэкенда (server-side). Не вызывай из браузера.
4. Добавь минимальный flow: форма телефона → send → форма кода → verify → успех.
5. Обрабатывай success=false и HTTP 401/422: показывай message пользователю.
6. Нормализуй телефон к цифрам (KZ: 8XXXXXXXXXX → 7XXXXXXXXXX).
7. По умолчанию НЕ передавай channel — используется канал компании из кабинета.
8. Таймер повторной отправки OTP ≥ 120 секунд (кулдаун на номер).
9. Не логируй API-токен и OTP-коды в открытом виде.
10. После интеграции кратко опиши, какие файлы изменены и как протестировать curl-ом.

Следуй спецификации эндпоинтов и примеров из этого же markdown-файла.
```

---

## Что это за сервис

Cascade отправляет одноразовые коды (OTP) на телефон клиента через:

| Канал | Значение `channel` | Когда использовать |
|-------|--------------------|--------------------|
| WhatsApp | `whatsapp` | По умолчанию у большинства компаний |
| Telegram | `telegram` | Если включён в кабинете («Откуда отправлять») |
| SMS | `sms` | Если включён; обычно дороже (больше токенов) |

**Типичный сценарий**

1. Пользователь вводит телефон у вас.
2. Ваш бэкенд: `POST /api/otp/send`.
3. Клиент получает код в мессенджере / SMS.
4. Пользователь вводит код у вас.
5. Ваш бэкенд: `POST /api/otp/verify`.
6. При `success: true` — логин / регистрация / подтверждение операции.

Каждая **успешная** доставка списывает токены с баланса компании (WhatsApp/Telegram обычно 1, SMS — по тарифу в кабинете).

---

## Быстрый старт (5 минут)

1. https://otp.kztusdt.kz/cabinet → **API-ключи** → **Создать** → скопировать ключ.
2. Пополнить баланс при необходимости.
3. В кабинете в разделе **Откуда отправлять** выбрать каналы и канал по умолчанию.
4. Проверка:

```bash
export OTP_API_TOKEN='ваш_ключ'

curl -sS -X POST "https://otp.kztusdt.kz/api/otp/send" \
  -H "Authorization: Bearer $OTP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"phone":"77001234567","purpose":"verification"}'
```

5. Код придёт на телефон → проверка:

```bash
curl -sS -X POST "https://otp.kztusdt.kz/api/otp/verify" \
  -H "Authorization: Bearer $OTP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"phone":"77001234567","code":"123456","purpose":"verification"}'
```

---

## Авторизация

Все эндпоинты ниже требуют:

```http
Authorization: Bearer <OTP_API_TOKEN>
Content-Type: application/json
Accept: application/json
```

| HTTP | Значение |
|------|----------|
| `401` | Нет / неверный токен |
| `200` | Успех (`success: true`) |
| `422` | Бизнес-ошибка или валидация (`success: false` или `errors`) |

Всегда смотри поле `success` в JSON, не только статус.

---

## Формат телефона

Поле `phone` — строка. Сервер нормализует (оставляет цифры).

| Ввод | Станет |
|------|--------|
| `+7 700 123 45 67` | `77001234567` |
| `87001234567` | `77001234567` |
| `77001234567` | `77001234567` |

Правила: после нормализации **10–15 цифр**; казахстанский `8…` (11 цифр) → `7…`.

На своей стороне можно слать как есть; лучше заранее нормализовать.

---

## POST /api/otp/send

Отправить OTP.

### Body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `phone` | string | да | Телефон получателя |
| `purpose` | string | нет | Сценарий, по умолчанию `verification`. Тот же `purpose` нужен в `verify` |
| `channel` | string | нет | `whatsapp` \| `telegram` \| `sms`. Если не указан — канал/авто из настроек компании в кабинете |
| `link` | string (URL) | нет | Опциональный http(s) URL: укорачивается и добавляется в то же сообщение, что и код. Успешная отправка = списание токенов как обычно |
| `link_expires_in` | int | нет | TTL короткой ссылки, сек (`60`…`2592000`) |

### Пример

```json
{
  "phone": "77001234567",
  "purpose": "registration"
}
```

С явным каналом:

```json
{
  "phone": "77001234567",
  "purpose": "login",
  "channel": "whatsapp"
}
```

С ссылкой в том же сообщении:

```json
{
  "phone": "77001234567",
  "purpose": "verification",
  "link": "https://example.com/confirm/abc",
  "link_expires_in": 3600
}
```

### Успех — `200`

```json
{
  "success": true,
  "message": "OTP отправлен через WhatsApp",
  "expires_in": 300,
  "short_url": "https://otp.kztusdt.kz/s/Ab3xK9"
}
```

`short_url` есть только если передан `link`.  
`expires_in` — жизнь кода в секундах (обычно 300).

### Ошибки — `422` (примеры)

```json
{ "success": false, "message": "Неверный формат номера телефона" }
```

```json
{ "success": false, "message": "Недостаточно токенов рассылки. Пополните баланс." }
```

```json
{ "success": false, "message": "Подождите перед повторной отправкой OTP" }
```

```json
{ "success": false, "message": "На этот номер уже недавно отправляли сообщение. Подождите 2 мин." }
```

```json
{ "success": false, "message": "WhatsApp не подключён. Обратитесь к администратору." }
```

```json
{ "success": false, "message": "Закреплённый номер WhatsApp для этого клиента временно недоступен. Попробуйте позже." }
```

Канал, выключенный в кабинете, тоже вернёт `422` с понятным `message`.

### Частые ошибки `otp/send`

| `message` | Что значит | Что делать |
|-----------|------------|------------|
| `Неверный формат номера телефона` | Номер не прошёл нормализацию | Проверьте `phone` (10–15 цифр) |
| `Недостаточно токенов рассылки…` | Нет баланса | Пополните в кабинете |
| `Подождите перед повторной отправкой OTP` | Rate limit на номер | Подождите ~2 мин, покажите таймер |
| `На этот номер уже недавно отправляли…` | Кулдаун после успешной доставки (120 сек) | Не спамьте `send`, ждите 2 мин |
| `Закреплённый номер WhatsApp… недоступен` | Этот телефон «привязан» к конкретной WA-сессии Cascade, и она сейчас офлайн | Повторите позже; админ должен переподключить WhatsApp |
| `WhatsApp не подключён…` | Нет активной WA-сессии | Обратитесь в поддержку / админку |
| `Invalid API token` / `API token required` | Нет/неверный Bearer | Проверьте ключ из кабинета |
| `Аккаунт приостановлен…` | Компания заблокирована | Свяжитесь с поддержкой |

> **Sticky sender:** после первой успешной доставки номер закрепляется за одним WhatsApp/Telegram аккаунтом Cascade. Повторные OTP на тот же телефон идут **предпочтительно** с него. Если закреплённая сессия недоступна или отправка с неё упала — API **автоматически переключит** на другой живой номер и перепривяжет клиента.

---

## POST /api/otp/verify

Проверить код.

### Body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `phone` | string | да | Тот же номер, что в `send` |
| `code` | string | да | Код из сообщения |
| `purpose` | string | нет | Тот же, что в `send` (по умолчанию `verification`) |

### Пример

```json
{
  "phone": "77001234567",
  "code": "482910",
  "purpose": "registration"
}
```

### Успех — `200`

```json
{
  "success": true,
  "message": "Номер подтверждён"
}
```

Код одноразовый. Повторный `verify` того же кода → ошибка.

### Ошибка

```json
{
  "success": false,
  "message": "Неверный или просроченный код"
}
```

Возможен `429`, если слишком много попыток.

---

## Каналы доставки

- Если **`channel` не передан** — используется настройка компании: фиксированный канал или `auto` (WhatsApp ↔ Telegram с фолбэком), см. кабинет **Откуда отправлять**.
- Если **`channel` передан** — используется он, но только если канал разрешён компании.
- Для продакшена чаще всего достаточно **не указывать** `channel` и настроить дефолт в кабинете.

Рекомендуемый UX-текст пользователю: «Код придёт в WhatsApp» / «в Telegram» / «по SMS» — в зависимости от вашего дефолта.

---

## POST /api/group/send

Уведомление в WhatsApp-группу (не OTP). Авторизация тем же Bearer-токеном.

### Body

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `group` | string | да | Название группы **или** id (`120363…@g.us` / числовой id) |
| `message` | string | да | Текст (до 4096 символов) |

### Примеры

```bash
curl -sS -X POST "https://otp.kztusdt.kz/api/group/send" \
  -H "Authorization: Bearer $OTP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"group":"Бизнес чат","message":"Новая заявка #123 оплачена"}'
```

```json
{
  "group": "120363411273110879@g.us",
  "message": "Алерт: баланс ниже порога"
}
```

### Успех — `200`

```json
{
  "success": true,
  "message": "Сообщение отправлено в группу",
  "error_code": null,
  "group_id": "120363411273110879@g.us",
  "group_name": "Бизнес чат",
  "message_id": "true_120363…@g.us_XXXXXXXX"
}
```

### Ошибки

| HTTP | `error_code` | Когда |
|------|--------------|-------|
| `401` | — | Нет / неверный токен |
| `404` | `group_not_found` | Группа не найдена по названию |
| `409` | `group_ambiguous` | Несколько групп с похожим именем — укажите `group_id` |
| `422` | `invalid_group` / `send_failed` | Валидация / ошибка отправки |
| `503` | `not_connected` | WhatsApp не подключён |

**Рекомендация:** один раз отправьте по названию, сохраните `group_id` из ответа и дальше всегда шлите по id. Аккаунт WhatsApp Cascade должен быть участником группы. Таймаут клиента — **60–90 сек**.

---

## Дополнительные API

### POST /api/links/shorten

Укоротить URL **без** отправки. Токены **не** списываются.

```json
{ "url": "https://example.com/very/long", "alias": "promo-may", "expires_in": 86400 }
```

### POST /api/links/send

Укоротить и отправить ссылку на телефон (без генерации OTP). Списывает токены за доставку.

```json
{
  "phone": "77001234567",
  "url": "https://example.com/promo",
  "channel": "whatsapp",
  "text": "Ваша ссылка: :link"
}
```

---

## Ограничения по умолчанию

| Параметр | Значение |
|----------|----------|
| Длина кода | 6 цифр |
| TTL кода | 300 сек (5 мин) |
| Кулдаун на номер после успешной доставки | **120 сек (2 мин)** |
| Повторный `send` (rate limit) | ~120 сек |
| Лимиты по API-токену / IP | есть (send / verify) |
| Sticky sender | номер закрепляется за одной WA/TG сессией; при недоступности — авто-фолбэк на другую |

Шаблон сообщения (примерно):

> Ваш код подтверждения: **123456**. Действителен 5 мин. Не сообщайте код никому.

---

## Примеры кода

### Env

```env
OTP_API_BASE_URL=https://otp.kztusdt.kz/api
OTP_API_TOKEN=ваш_ключ_из_кабинета
```

### PHP (Laravel)

```php
<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

final class CascadeOtpClient
{
    private readonly string $baseUrl;

    private readonly string $token;

    public function __construct(?string $baseUrl = null, ?string $token = null)
    {
        $this->baseUrl = rtrim($baseUrl ?? (string) config('services.otp.base_url', 'https://otp.kztusdt.kz/api'), '/');
        $this->token = $token ?? (string) config('services.otp.token', '');
    }

    /** @param  array{purpose?: string, channel?: string, link?: string, link_expires_in?: int}  $options */
    public function send(string $phone, array $options = []): array
    {
        $payload = array_filter([
            'phone' => $phone,
            'purpose' => $options['purpose'] ?? 'verification',
            'channel' => $options['channel'] ?? null,
            'link' => $options['link'] ?? null,
            'link_expires_in' => $options['link_expires_in'] ?? null,
        ], static fn ($v) => $v !== null && $v !== '');

        $response = Http::withToken($this->token)
            ->acceptJson()
            ->timeout(30)
            ->post("{$this->baseUrl}/otp/send", $payload);

        return $response->json() ?? ['success' => false, 'message' => 'Empty response'];
    }

    public function verify(string $phone, string $code, string $purpose = 'verification'): array
    {
        $response = Http::withToken($this->token)
            ->acceptJson()
            ->timeout(30)
            ->post("{$this->baseUrl}/otp/verify", [
                'phone' => $phone,
                'code' => $code,
                'purpose' => $purpose,
            ]);

        return $response->json() ?? ['success' => false, 'message' => 'Empty response'];
    }

    public function sendOrFail(string $phone, array $options = []): array
    {
        $result = $this->send($phone, $options);
        if (! ($result['success'] ?? false)) {
            throw new RuntimeException((string) ($result['message'] ?? 'OTP send failed'));
        }

        return $result;
    }
}
```

`config/services.php`:

```php
'otp' => [
    'base_url' => env('OTP_API_BASE_URL', 'https://otp.kztusdt.kz/api'),
    'token' => env('OTP_API_TOKEN'),
],
```

### Node.js / TypeScript

```ts
const BASE_URL = process.env.OTP_API_BASE_URL ?? 'https://otp.kztusdt.kz/api';
const TOKEN = process.env.OTP_API_TOKEN!;

type SendOptions = {
  purpose?: string;
  channel?: 'whatsapp' | 'telegram' | 'sms';
  link?: string;
  link_expires_in?: number;
};

async function sendOtp(phone: string, options: SendOptions = {}) {
  const res = await fetch(`${BASE_URL}/otp/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      phone,
      purpose: options.purpose ?? 'verification',
      ...(options.channel ? { channel: options.channel } : {}),
      ...(options.link ? { link: options.link } : {}),
      ...(options.link_expires_in ? { link_expires_in: options.link_expires_in } : {}),
    }),
  });
  return res.json() as Promise<{ success: boolean; message?: string; expires_in?: number; short_url?: string }>;
}

async function verifyOtp(phone: string, code: string, purpose = 'verification') {
  const res = await fetch(`${BASE_URL}/otp/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ phone, code, purpose }),
  });
  return res.json() as Promise<{ success: boolean; message?: string }>;
}

export { sendOtp, verifyOtp };
```

### Python

```python
import os
import requests

BASE_URL = os.getenv("OTP_API_BASE_URL", "https://otp.kztusdt.kz/api").rstrip("/")
TOKEN = os.environ["OTP_API_TOKEN"]

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def send_otp(phone: str, purpose: str = "verification", channel: str | None = None, link: str | None = None) -> dict:
    payload = {"phone": phone, "purpose": purpose}
    if channel:
        payload["channel"] = channel
    if link:
        payload["link"] = link
    r = requests.post(f"{BASE_URL}/otp/send", json=payload, headers=HEADERS, timeout=30)
    return r.json()


def verify_otp(phone: str, code: str, purpose: str = "verification") -> dict:
    r = requests.post(
        f"{BASE_URL}/otp/verify",
        json={"phone": phone, "code": code, "purpose": purpose},
        headers=HEADERS,
        timeout=30,
    )
    return r.json()
```

---

## Webhooks (исходящие)

В кабинете: **Интеграция → Webhooks**.

События: `otp.sent`, `otp.verified`, `otp.failed`.

```http
POST <ваш_url>
Content-Type: application/json
X-Webhook-Event: otp.sent
X-Webhook-Signature: sha256=<hmac_sha256_hex_of_raw_body>
```

Подпись: HMAC-SHA256 сырого тела с секретом webhook.

```php
$expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
hash_equals($expected, $request->header('X-Webhook-Signature'));
```

---

## Чеклист для агента после интеграции

- [ ] `OTP_API_TOKEN` только в env/secrets
- [ ] Вызовы только с сервера
- [ ] `send` + `verify` с одинаковым `purpose`
- [ ] UI показывает `message` при ошибке
- [ ] Таймер повторной отправки ≥ **120 сек**
- [ ] Обработаны сообщения про кулдаун и «Закреплённый номер WhatsApp…»
- [ ] Тестовый curl `send`/`verify` на реальный номер прошёл
- [ ] В кабинете видна запись в **Отправленные коды**
- [ ] (опционально) `group/send` протестирован, сохранён `group_id`

---

## Карта эндпоинтов

| Метод | Путь | Назначение |
|-------|------|------------|
| `POST` | `/api/otp/send` | Отправить OTP |
| `POST` | `/api/otp/verify` | Проверить OTP |
| `POST` | `/api/group/send` | Текст в WhatsApp-группу |
| `POST` | `/api/links/shorten` | Укоротить URL (бесплатно) |
| `POST` | `/api/links/send` | Укоротить и отправить ссылку |

---

## Поддержка

- Кабинет: https://otp.kztusdt.kz/cabinet  
- Docs: https://otp.kztusdt.kz/docs  
- Скачать MD: https://otp.kztusdt.kz/cascade-otp-integration.md  
- OpenAPI: https://otp.kztusdt.kz/openapi.yaml  
- Email: support@otp.kztusdt.kz  

Версия документа: **2026-07-29** · API base `https://otp.kztusdt.kz/api`
