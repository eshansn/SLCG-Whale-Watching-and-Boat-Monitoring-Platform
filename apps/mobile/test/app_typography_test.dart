import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:wwms_app/widgets/app_typography.dart';

Iterable<TextStyle> _styles(TextTheme theme) => [
      theme.displayLarge!,
      theme.displayMedium!,
      theme.displaySmall!,
      theme.headlineLarge!,
      theme.headlineMedium!,
      theme.headlineSmall!,
      theme.titleLarge!,
      theme.titleMedium!,
      theme.titleSmall!,
      theme.bodyLarge!,
      theme.bodyMedium!,
      theme.bodySmall!,
      theme.labelLarge!,
      theme.labelMedium!,
      theme.labelSmall!,
    ];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('website Montserrat theme covers every Material text role', () {
    final theme = withWebsiteMontserrat(ThemeData.light());

    for (final style in [
      ..._styles(theme.textTheme),
      ..._styles(theme.primaryTextTheme),
    ]) {
      expect(style.fontFamily, startsWith('Montserrat'));
    }
  });

  test('website Poppins theme covers every Material text role', () {
    final theme = withWebsitePoppins(ThemeData.light());

    for (final style in [
      ..._styles(theme.textTheme),
      ..._styles(theme.primaryTextTheme),
    ]) {
      expect(style.fontFamily, startsWith('Poppins'));
    }
  });
}
