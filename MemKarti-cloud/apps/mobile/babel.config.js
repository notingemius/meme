module.exports = (api) => {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    // ОБОВ'ЯЗКОВО для react-native-reanimated v4: плагін worklets перетворює
    // useAnimatedStyle/useSharedValue у worklet'и. Без нього reanimated падає
    // при рендері (KeyboardAvoidingAnimatedView) -> білий екран у release APK.
    // Має бути ОСТАННІМ у списку плагінів.
    plugins: ['react-native-worklets/plugin'],
  };
};
