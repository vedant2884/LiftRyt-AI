import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../state/active_workout_state.dart';

/// One set inside an exercise card — weight/reps entry, complete/duplicate/
/// remove, all inline and touch-sized for gym use (44px controls, no modal
/// needed to log a set).
///
/// Stateful (not a plain build-from-props widget) because its two text
/// fields need a `TextEditingController` kept in sync with `set.weight`/
/// `set.reps` when they change from OUTSIDE typing — e.g. a progression
/// suggestion prefilling the first set's weight — which a bare
/// `TextFormField(initialValue: ...)` would silently miss after first build.
class SetRow extends StatefulWidget {
  final DraftSet set;
  final int index;
  final ValueChanged<String> onWeightChanged;
  final ValueChanged<String> onRepsChanged;
  final VoidCallback onComplete;
  final VoidCallback onDuplicate;
  final VoidCallback onRemove;

  const SetRow({
    super.key,
    required this.set,
    required this.index,
    required this.onWeightChanged,
    required this.onRepsChanged,
    required this.onComplete,
    required this.onDuplicate,
    required this.onRemove,
  });

  @override
  State<SetRow> createState() => _SetRowState();
}

class _SetRowState extends State<SetRow> {
  late final TextEditingController _weightController;
  late final TextEditingController _repsController;

  @override
  void initState() {
    super.initState();
    _weightController = TextEditingController(text: widget.set.weight);
    _repsController = TextEditingController(text: widget.set.reps);
  }

  @override
  void didUpdateWidget(SetRow old) {
    super.didUpdateWidget(old);
    if (widget.set.weight != _weightController.text && widget.set.weight != old.set.weight) {
      _weightController.text = widget.set.weight;
    }
    if (widget.set.reps != _repsController.text && widget.set.reps != old.set.reps) {
      _repsController.text = widget.set.reps;
    }
  }

  @override
  void dispose() {
    _weightController.dispose();
    _repsController.dispose();
    super.dispose();
  }

  bool get _canComplete =>
      widget.set.weight.trim().isNotEmpty && widget.set.reps.trim().isNotEmpty && !widget.set.saving;

  @override
  Widget build(BuildContext context) {
    final set = widget.set;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: set.completed ? const Color(0xFF34D399).withValues(alpha: 0.06) : null,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 20,
            child: Text(
              '${widget.index + 1}',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.inkMuted, fontSize: 12),
            ),
          ),
          const SizedBox(width: 6),
          if (set.completed) ...[
            Expanded(
              child: Text('${set.weight} kg', textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.ink, fontSize: 14)),
            ),
            Expanded(
              child: Text('${set.reps} reps', textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.ink, fontSize: 14)),
            ),
          ] else ...[
            Expanded(
              child: _numberField(controller: _weightController, hint: 'kg', onChanged: widget.onWeightChanged),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: _numberField(controller: _repsController, hint: 'reps', onChanged: widget.onRepsChanged),
            ),
          ],
          if (set.isPr) ...[
            const SizedBox(width: 6),
            const _PrBadge(),
          ],
          const SizedBox(width: 4),
          if (!set.completed)
            SizedBox(
              width: 44,
              height: 44,
              child: IconButton(
                onPressed: _canComplete ? widget.onComplete : null,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  disabledBackgroundColor: AppColors.accent.withValues(alpha: 0.3),
                ),
                icon: set.saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check, color: Colors.white, size: 18),
              ),
            ),
          SizedBox(
            width: 40,
            height: 44,
            child: IconButton(
              onPressed: widget.onDuplicate,
              icon: const Icon(Icons.copy_rounded, size: 16),
              color: AppColors.inkMuted,
            ),
          ),
          SizedBox(
            width: 40,
            height: 44,
            child: IconButton(
              onPressed: widget.onRemove,
              icon: const Icon(Icons.delete_outline_rounded, size: 18),
              color: AppColors.inkMuted,
            ),
          ),
        ],
      ),
    );
  }

  Widget _numberField({
    required TextEditingController controller,
    required String hint,
    required ValueChanged<String> onChanged,
  }) {
    return TextFormField(
      controller: controller,
      onChanged: onChanged,
      textAlign: TextAlign.center,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      style: const TextStyle(fontSize: 14),
      decoration: InputDecoration(
        isDense: true,
        hintText: hint,
        contentPadding: const EdgeInsets.symmetric(vertical: 10),
      ),
    );
  }
}

class _PrBadge extends StatelessWidget {
  const _PrBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.star_rounded, size: 10, color: Color(0xFFFBBF24)),
          SizedBox(width: 2),
          Text('PR', style: TextStyle(color: Color(0xFFFBBF24), fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
