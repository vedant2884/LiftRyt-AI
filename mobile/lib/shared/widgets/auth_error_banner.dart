import 'package:flutter/material.dart';

/// Same red-tinted inline error banner every auth form on the web uses
/// (`rounded-md bg-red-500/10 ... text-red-400`) — kept as one widget so the
/// four auth screens read identically.
class AuthErrorBanner extends StatelessWidget {
  final String message;

  const AuthErrorBanner({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEF4444).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: const TextStyle(color: Color(0xFFF87171), fontSize: 13),
      ),
    );
  }
}
