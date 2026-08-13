import 'package:flutter/material.dart';

/// A full-width primary action button with a built-in loading spinner —
/// every auth screen needs this exact "disabled + spinner while in flight"
/// behavior, so it's factored out once rather than repeated per screen.
class PrimaryButton extends StatelessWidget {
  final String label;
  final String loadingLabel;
  final bool loading;
  final VoidCallback? onPressed;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.loading,
    required this.onPressed,
    String? loadingLabel,
  }) : loadingLabel = loadingLabel ?? label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: loading ? null : onPressed,
        child: loading
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  Text(loadingLabel),
                ],
              )
            : Text(label),
      ),
    );
  }
}
