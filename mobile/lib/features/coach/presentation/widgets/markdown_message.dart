import 'package:flutter/material.dart';

/// Renders the coach's reply using the exact same restricted markdown
/// subset `frontend/src/components/MarkdownMessage.tsx` allows — bold,
/// bullet/numbered lists, paragraphs, headings folded into bold text — as a
/// small dependency-free parser rather than pulling in a general-purpose
/// markdown package for a handful of tags.
class MarkdownMessage extends StatelessWidget {
  final String content;
  final Color textColor;

  const MarkdownMessage({super.key, required this.content, this.textColor = const Color(0xFFF5F5F5)});

  @override
  Widget build(BuildContext context) {
    final lines = content.split('\n');
    final widgets = <Widget>[];
    var i = 0;
    while (i < lines.length) {
      final line = lines[i];
      final trimmed = line.trim();
      if (trimmed.isEmpty) {
        i++;
        continue;
      }
      if (trimmed.startsWith('#')) {
        widgets.add(_richText(trimmed.replaceFirst(RegExp(r'^#+\s*'), ''), bold: true));
      } else if (RegExp(r'^[-*]\s+').hasMatch(trimmed)) {
        while (i < lines.length && RegExp(r'^[-*]\s+').hasMatch(lines[i].trim())) {
          widgets.add(_bulletLine(lines[i].trim().replaceFirst(RegExp(r'^[-*]\s+'), '')));
          i++;
        }
        continue;
      } else if (RegExp(r'^\d+\.\s+').hasMatch(trimmed)) {
        while (i < lines.length && RegExp(r'^\d+\.\s+').hasMatch(lines[i].trim())) {
          final match = RegExp(r'^(\d+)\.\s+(.*)').firstMatch(lines[i].trim())!;
          widgets.add(_bulletLine(match.group(2)!, prefix: '${match.group(1)}.'));
          i++;
        }
        continue;
      } else {
        widgets.add(_richText(trimmed));
      }
      i++;
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: 6, children: widgets);
  }

  Widget _bulletLine(String text, {String prefix = '•'}) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 18, child: Text(prefix, style: TextStyle(color: textColor, fontSize: 13))),
          Expanded(child: _richText(text)),
        ],
      ),
    );
  }

  Widget _richText(String text, {bool bold = false}) {
    final spans = <TextSpan>[];
    final parts = text.split(RegExp(r'(\*\*.*?\*\*)'));
    for (final part in parts) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 3) {
        spans.add(TextSpan(
          text: part.substring(2, part.length - 2),
          style: const TextStyle(fontWeight: FontWeight.w700),
        ));
      } else if (part.isNotEmpty) {
        spans.add(TextSpan(text: part));
      }
    }
    return RichText(
      text: TextSpan(
        style: TextStyle(
          color: textColor,
          fontSize: 13,
          height: 1.4,
          fontWeight: bold ? FontWeight.w700 : FontWeight.normal,
        ),
        children: spans,
      ),
    );
  }
}
