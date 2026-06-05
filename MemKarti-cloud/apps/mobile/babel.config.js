module.exports = (api) => {
  api.cache(true);
  return {
    // DEBUG (тимчасово): removeConsole=false — щоб у release APK не вирізались
    // console.log і ми могли діагностувати білий екран через logcat.
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true, removeConsole: false }]],
    // ОБОВ'ЯЗКОВО для react-native-reanimated v4: плагін worklets перетворює
    // useAnimatedStyle/useSharedValue у worklet'и. Без нього reanimated падає
    // при рендері (KeyboardAvoidingAnimatedView) -> білий екран у release APK.
    // Має бути ОСТАННІМ у списку плагінів.
    plugins: ['react-native-worklets/plugin'],
  };
};
