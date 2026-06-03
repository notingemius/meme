// OTA-обновления "по воздуху" через expo-updates.
//
// Модуль подключается лениво и безопасно: если expo-updates не установлен
// (или мы в Expo Go / dev-режиме), приложение всё равно работает, а кнопка
// "Обновить" просто покажет, что обновления недоступны.
//
// Чтобы OTA реально заработало, нужно один раз:
//   1) npx expo install expo-updates
//   2) eas init && eas update:configure   (заполнит app.json)
//   3) собрать APK с этим конфигом
// После этого новые JS-сборки прилетают командой:
//   eas update --branch <ветка> -m "что поправил"

let Updates: any = null;
try {
  // @ts-ignore — пакет добавляется через `npx expo install expo-updates`
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Updates = require('expo-updates');
} catch {
  Updates = null;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'no-update'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'unsupported';

export type UpdateStateInfo = {
  state: UpdateState;
  message?: string;
};

// Доступны ли OTA-обновления в текущей сборке.
export function isOtaSupported(): boolean {
  if (!Updates || typeof Updates.checkForUpdateAsync !== 'function') return false;
  // В Expo Go и dev-сборке Updates.isEnabled === false
  if (Updates.isEnabled === false) return false;
  return true;
}

// Короткая информация о текущей установленной версии (для экрана "О программе").
export function getRuntimeInfo(): { channel?: string; updateId?: string; runtimeVersion?: string } {
  if (!Updates) return {};
  return {
    channel: Updates.channel ?? undefined,
    updateId: Updates.updateId ?? undefined,
    runtimeVersion: Updates.runtimeVersion ?? undefined,
  };
}

// Проверить, скачать и применить обновление.
// onState вызывается на каждом шаге, чтобы UI показывал прогресс.
export async function checkAndApplyUpdate(
  onState: (info: UpdateStateInfo) => void,
): Promise<void> {
  if (!isOtaSupported()) {
    onState({ state: 'unsupported' });
    return;
  }
  try {
    onState({ state: 'checking' });
    const result = await Updates.checkForUpdateAsync();
    if (!result?.isAvailable) {
      onState({ state: 'no-update' });
      return;
    }
    onState({ state: 'downloading' });
    await Updates.fetchUpdateAsync();
    onState({ state: 'ready' });
    // Перезапуск приложения с новой версией.
    await Updates.reloadAsync();
  } catch (e: any) {
    onState({ state: 'error', message: e?.message ? String(e.message) : String(e) });
  }
}
