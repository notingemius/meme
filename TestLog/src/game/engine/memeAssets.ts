// RN-ONLY: статичні require() локальних мем-картинок, зашитих у APK.
// Цей файл НЕ імпортується движком (engine.ts), бо движок крутиться і в Node
// (симуляції), де require('*.png') не працює. UI резолвить картинку за id картки.
//
// Metro вимагає СТАТИЧНІ літерали в require(), тому таблиця розписана явно.
import type { ImageSourcePropType } from 'react-native';

export const MEME_ASSETS: Record<number, ImageSourcePropType> = {
  1: require('../../../assets/memes/meme_01.png'),
  2: require('../../../assets/memes/meme_02.png'),
  3: require('../../../assets/memes/meme_03.png'),
  4: require('../../../assets/memes/meme_04.png'),
  5: require('../../../assets/memes/meme_05.png'),
  6: require('../../../assets/memes/meme_06.png'),
  7: require('../../../assets/memes/meme_07.png'),
  8: require('../../../assets/memes/meme_08.png'),
  9: require('../../../assets/memes/meme_09.png'),
  10: require('../../../assets/memes/meme_10.png'),
  11: require('../../../assets/memes/meme_11.png'),
  12: require('../../../assets/memes/meme_12.png'),
  13: require('../../../assets/memes/meme_13.png'),
  14: require('../../../assets/memes/meme_14.png'),
  15: require('../../../assets/memes/meme_15.png'),
  16: require('../../../assets/memes/meme_16.png'),
  17: require('../../../assets/memes/meme_17.png'),
  18: require('../../../assets/memes/meme_18.png'),
  19: require('../../../assets/memes/meme_19.png'),
  20: require('../../../assets/memes/meme_20.png'),
  21: require('../../../assets/memes/meme_21.png'),
  22: require('../../../assets/memes/meme_22.png'),
  23: require('../../../assets/memes/meme_23.png'),
  24: require('../../../assets/memes/meme_24.png'),
  25: require('../../../assets/memes/meme_25.png'),
  26: require('../../../assets/memes/meme_26.png'),
  27: require('../../../assets/memes/meme_27.png'),
  28: require('../../../assets/memes/meme_28.png'),
  29: require('../../../assets/memes/meme_29.png'),
  30: require('../../../assets/memes/meme_30.png'),
  31: require('../../../assets/memes/meme_31.png'),
  32: require('../../../assets/memes/meme_32.png'),
  33: require('../../../assets/memes/meme_33.png'),
  34: require('../../../assets/memes/meme_34.png'),
  35: require('../../../assets/memes/meme_35.png'),
  36: require('../../../assets/memes/meme_36.png'),
  37: require('../../../assets/memes/meme_37.png'),
  38: require('../../../assets/memes/meme_38.png'),
  39: require('../../../assets/memes/meme_39.png'),
  40: require('../../../assets/memes/meme_40.png'),
  41: require('../../../assets/memes/meme_41.png'),
  42: require('../../../assets/memes/meme_42.png'),
  43: require('../../../assets/memes/meme_43.png'),
  44: require('../../../assets/memes/meme_44.png'),
  45: require('../../../assets/memes/meme_45.png'),
  46: require('../../../assets/memes/meme_46.png'),
  47: require('../../../assets/memes/meme_47.png'),
  48: require('../../../assets/memes/meme_48.png'),
  49: require('../../../assets/memes/meme_49.png'),
  50: require('../../../assets/memes/meme_50.png'),
};

export function memeAsset(id: number): ImageSourcePropType | null {
  return MEME_ASSETS[id] ?? null;
}
