# Сборка APK в облаке (Linux-агент)

Архив уже подготовлен: исходники без node_modules и без Windows-папки `android/`.
Иконки починены, имя приложения «МемКарти», package `com.memkarti.app`.
Фикс бага бандла в `apps/mobile/metro.config.js` уже внесён.

## Шаги

```bash
# 0. распаковать архив и зайти в корень проекта
unzip MemKarti-cloud.zip -d memkarti && cd memkarti

# 1. включить yarn 4 и поставить зависимости
corepack enable
corepack prepare yarn@4.12.0 --activate
yarn install

# 2. ВАЖНО: отключить загрузку Sentry (иначе release падает)
export SENTRY_DISABLE_AUTO_UPLOAD=true
export SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true

# 3. сгенерировать нативный android-проект заново (под Linux)
cd apps/mobile
npx expo prebuild -p android --clean

# 4. собрать APK
cd android
./gradlew assembleRelease

# готовый файл:
# apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

## Требования к окружению
- Node 20+ , JDK 17, Android SDK + NDK + cmake (Android SDK обычно уже есть на образе)
- 8+ ГБ RAM (на 8 ГБ Windows-машине сборка падала по памяти — в облаке с 30 ГБ норм)

## Если используешь EAS (облако Expo) — ещё проще
```bash
npm i -g eas-cli
eas login
cd apps/mobile
eas build -p android --profile preview   # вернёт ссылку на .apk
```
Профиль `preview` в `eas.json` уже настроен на выдачу `.apk`.

## Заметки
- Предупреждение про AGP 8.11 в Android Studio к облачной Gradle-сборке отношения не имеет.
- Warning про `android_app_id` (google-mobile-ads) можно игнорировать — на сборку не влияет.
- Wi-Fi-режим использует нативные модули (react-native-tcp-socket, react-native-qrcode-svg,
  expo-network) — они уже в package.json и подхватятся при prebuild.
