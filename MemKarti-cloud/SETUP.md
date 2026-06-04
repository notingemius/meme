# МемКарти — як запустити та зібрати APK

Це **онлайн** мем-гра: мобільний клієнт (Expo / React Native) + бекенд (Next.js + PostgreSQL/Neon).
Щоб гра працювала, потрібні **обидві частини**: телефон ходить у бекенд через `EXPO_PUBLIC_BASE_URL`.

---

## Що я вже додав/полагодив

- **`apps/web/db/schema.sql`** — повна схема БД (її в архіві не було — без неї гра не працювала).
- **`apps/web/db/seed.sql`** — колода: **39 ситуацій + 50 мем-карт** (українською).
- **Баг анонімності** у `apps/web/.../rooms/[code]/state/route.ts` — автори мемів більше не розкриваються до фази результатів.

> Картинки мемів зараз — згенеровані картки з текстом (placehold.co), щоб все відображалось «з коробки».
> Щоб поставити справжні картинки-меми — заміни `image_url` у `seed.sql` на будь-які публічні URL картинок (або завантаж через Uploadcare).

---

## Крок 1. База даних (Neon)

1. Створи безкоштовну БД на https://neon.tech → скопіюй `DATABASE_URL` (connection string).
2. Застосуй схему і колоду:
   ```bash
   psql "postgresql://...neon..." -f apps/web/db/schema.sql
   psql "postgresql://...neon..." -f apps/web/db/seed.sql
   ```
   (якщо немає `psql` — можна вставити SQL у SQL-редактор Neon у браузері).

## Крок 2. Бекенд (Next.js, `apps/web`)

1. У `apps/web` створи `.env`:
   ```
   DATABASE_URL=postgresql://...neon...
   ```
2. Локально:
   ```bash
   corepack enable
   yarn install
   yarn workspace web dev      # підніме на http://localhost:4000
   ```
3. Для реальної гри з телефону задеплой бекенд (напр. **Vercel**) — отримаєш публічний URL вигляду `https://memkarti.vercel.app`.

## Крок 3. Мобільний клієнт (`apps/mobile`)

1. У `apps/mobile/.env` пропиши адресу бекенду:
   ```
   EXPO_PUBLIC_BASE_URL=https://memkarti.vercel.app
   ```
   (для локального тесту — IP комп'ютера в одній Wi-Fi-мережі, напр. `http://192.168.0.10:4000`)
2. У `apps/mobile/app.json` зміни `android.package` на свій, напр. `com.pavel.memkarti`.
3. Швидкий тест без збірки (через додаток Expo Go):
   ```bash
   yarn workspace mobile expo start
   ```

## Крок 4. Готовий APK (EAS Build)

Expo-додатки збираються через **EAS** (хмарна збірка), не через Android Studio напряму.

```bash
npm i -g eas-cli
eas login                       # безкоштовний акаунт expo.dev
cd apps/mobile
eas build -p android --profile preview
```

- Профіль **`preview`** (вже є у `eas.json`) → дає **`.apk`** для встановлення «для себе».
- Профіль `production` → дає `.aab` для Google Play.
- Після збірки EAS дасть посилання → скачай APK → перекинь на телефон → встанови (дозвіл «з невідомих джерел»).

---

## Чому я не зібрав APK за тебе

Сама компіляція APK потребує Android SDK + інтернету (для EAS / встановлення залежностей), чого немає в моїй пісочниці.
Я підготував проєкт так, щоб збірка була **в одну команду** (`eas build`).
Якщо хочеш — можу далі доопрацьовувати код, розширювати колоду або допомогти з деплоєм бекенда.
