# Обновления «по воздуху» (OTA) — МемКарти

Игра поддерживает обновления **без пересборки APK**: код и картинки прилетают
по интернету через **Expo Updates (EAS Update)**. В приложении есть кнопка
**«⟳ Оновити застосунок»** на главном экране — она проверяет, скачивает и
применяет обновление.

## Что прилетает по воздуху, а что нет

| Изменение | Способ доставки | Пересборка APK? |
|---|---|---|
| JS/TS код (логика, UI, тексты, правила) | `eas update` (OTA) | ❌ нет |
| Картинки мемов, ассеты | `eas update` (OTA) | ❌ нет |
| Новый нативный модуль / смена версий expo/react-native | `eas build` | ✅ да |
| Смена иконки, прав, имени пакета | `eas build` | ✅ да |

> OTA работает только пока **runtimeVersion** сборки совпадает с обновлением.
> Сейчас `runtimeVersion.policy = "appVersion"`, то есть он привязан к
> `version` в `app.json` (`1.0.0`). Меняешь нативную часть → подними version и
> собери APK заново.

## Настройка (один раз)

Нужен бесплатный аккаунт на https://expo.dev

```bash
npm i -g eas-cli           # ставим EAS CLI
eas login                  # вход в свой Expo-аккаунт
cd TestLog
npx expo install expo-updates   # ставим правильную версию пакета под SDK
eas init                   # создаёт projectId и пишет его в app.json
eas update:configure       # заполняет updates.url и runtimeVersion в app.json
```

После `eas init` / `eas update:configure` плейсхолдеры
`REPLACE_WITH_PROJECT_ID` в `app.json` заменятся на реальные значения.

## Собрать APK (один раз с поддержкой OTA)

Вариант 1 — облако Expo (проще, SDK уже у них):
```bash
eas build -p android --profile preview
```
Через ~10 минут получишь ссылку на готовый APK. Установи его на телефон.

Вариант 2 — локально (нужны Android SDK + JDK 17):
```bash
npx expo prebuild -p android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

> Важно: APK должен быть собран **на том же канале**, что и обновления.
> Профиль `preview` собирает на канале `preview` (см. `eas.json`).

## Выпустить обновление (каждый раз, когда поменял код)

```bash
cd TestLog
eas update --branch preview -m "что поправил"
```

Готово. На телефоне жми **«⟳ Оновити застосунок»** в меню — приложение
скачает новый код и перезапустится. Либо обновление подхватится само при
следующем запуске (`checkAutomatically: ON_LOAD`).

## Как работает кнопка в приложении

Код: `TestLog/src/updates.ts` + кнопка в `TestLog/src/screens/MenuScreen.tsx`.
Логика: `checkForUpdateAsync()` → `fetchUpdateAsync()` → `reloadAsync()`.

Кнопка устойчива к ошибкам: если `expo-updates` не установлен или это
Expo Go / dev-режим, она просто покажет «Оновлення недоступні» и ничего не
сломает.
