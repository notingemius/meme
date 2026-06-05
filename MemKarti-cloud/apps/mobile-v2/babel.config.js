module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated v3 — потрібен плагін worklets з самого reanimated пакету.
    plugins: ['react-native-reanimated/plugin'],
  };
};
