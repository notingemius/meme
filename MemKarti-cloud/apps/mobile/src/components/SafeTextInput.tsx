/**
 * SafeTextInput — drop-in replacement for React Native's TextInput on Android.
 *
 * Reason: in Expo SDK 54 (react-native 0.81.4) with new architecture (Fabric)
 * enabled, the stock <TextInput> silently fails to mount on Android — the
 * entire JSX subtree becomes invisible (white screen) with no JS error.
 * Reanimated v4 requires new arch so we cannot disable it.
 *
 * react-native-paper's TextInput uses its own native wrapper (not the broken
 * Fabric <AndroidTextInput>), so it renders correctly under Fabric.
 *
 * This adapter accepts the same props as the stock <TextInput> so the rest
 * of the codebase doesn't have to change semantics.
 */
import React from 'react';
import { View, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { TextInput as PaperTextInput } from 'react-native-paper';
import type { TextInputProps } from 'react-native';

const SafeTextInput = React.forwardRef<any, TextInputProps>((props, ref) => {
  const {
    value,
    onChangeText,
    placeholder,
    placeholderTextColor,
    maxLength,
    autoCapitalize,
    secureTextEntry,
    keyboardType,
    style,
    editable,
    multiline,
    onBlur,
    onFocus,
    onSubmitEditing,
    returnKeyType,
    autoCorrect,
    autoFocus,
    selectionColor,
  } = props;

  // Extract layout / outer styles from style prop so the View wrapper holds
  // them while the input itself gets the typography styles.
  const flat = StyleSheet.flatten(style) || ({} as TextStyle & ViewStyle);
  const {
    backgroundColor,
    width,
    height,
    minHeight,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    borderWidth,
    borderColor,
    borderRadius,
    flex,
    alignSelf,
    color,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing,
    textAlign,
    padding,
    paddingHorizontal,
    paddingVertical,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    ...rest
  } = flat as any;

  const wrapperStyle: ViewStyle = {
    backgroundColor: backgroundColor ?? '#FFFFFF',
    width,
    height,
    minHeight,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    borderWidth: borderWidth ?? 1,
    borderColor: borderColor ?? '#E5E7EB',
    borderRadius: borderRadius ?? 8,
    flex,
    alignSelf,
    paddingHorizontal: paddingHorizontal ?? 0,
    paddingVertical: paddingVertical ?? 0,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    padding,
    overflow: 'hidden',
  };

  const contentStyle: TextStyle = {
    color: color ?? '#111827',
    fontSize: fontSize ?? 15,
    fontFamily,
    fontWeight,
    letterSpacing,
    textAlign,
  };

  return (
    <View style={wrapperStyle}>
      <PaperTextInput
        ref={ref}
        mode="flat"
        underlineColor="transparent"
        activeUnderlineColor="transparent"
        value={value}
        onChangeText={onChangeText}
        placeholder={typeof placeholder === 'string' ? placeholder : undefined}
        placeholderTextColor={placeholderTextColor as string | undefined}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        onBlur={onBlur as any}
        onFocus={onFocus as any}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        selectionColor={selectionColor as string}
        dense
        contentStyle={contentStyle}
        style={{
          backgroundColor: 'transparent',
          fontSize: fontSize ?? 15,
        }}
        theme={{ colors: { background: 'transparent', surface: 'transparent' } }}
      />
    </View>
  );
});

SafeTextInput.displayName = 'SafeTextInput';

export default SafeTextInput;
