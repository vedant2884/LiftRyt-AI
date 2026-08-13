import 'package:flutter/material.dart';

/// Color tokens mirrored 1:1 from the web app's `frontend/src/index.css`
/// (`--bg`, `--surface`, `--ink`, `--accent`, ...) so the mobile app reads as
/// the same product rather than a reskinned Flutter template. Dark is the
/// only theme implemented so far, matching the web app's dark-first default;
/// a light variant can be added later the same way index.css defines one.
class AppColors {
  AppColors._();

  static const bg = Color(0xFF0A0A0A);
  static const surface = Color(0xFF171717);
  static const surfaceHover = Color(0xFF262626);
  static const line = Color(0xFF262626);
  static const lineStrong = Color(0xFF404040);
  static const ink = Color(0xFFF5F5F5);
  static const inkSecondary = Color(0xFFA3A3A3);
  static const inkMuted = Color(0xFF737373);
  static const accent = Color(0xFF8B5CF6);
}

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData(
      brightness: Brightness.dark,
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.bg,
      colorScheme: const ColorScheme.dark(
        surface: AppColors.bg,
        primary: AppColors.accent,
        onPrimary: Colors.white,
        secondary: AppColors.accent,
        error: Color(0xFFEF4444),
      ),
    );

    return base.copyWith(
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.bg,
        foregroundColor: AppColors.ink,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.lineStrong),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.lineStrong),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.accent),
        ),
        hintStyle: const TextStyle(color: AppColors.inkMuted),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.line, space: 1),
    );
  }
}
