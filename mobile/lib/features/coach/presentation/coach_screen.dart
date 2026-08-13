import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../data/coach_api.dart';
import '../data/models.dart';
import 'widgets/markdown_message.dart';
import 'widgets/tool_result_card.dart';

const _suggestedPrompts = [
  'How am I progressing?',
  'Review my latest workout',
  'What should I train today?',
];

String _formatTime(DateTime d) {
  final hour = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final minute = d.minute.toString().padLeft(2, '0');
  final period = d.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

String _formatSessionDate(DateTime d) {
  final now = DateTime.now();
  if (d.year == now.year && d.month == now.month && d.day == now.day) return _formatTime(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${months[d.month - 1]} ${d.day}';
}

/// Mirrors `frontend/src/pages/CoachPage.tsx` and its recently-redesigned
/// premium empty state — same backend/Groq integration (never a second AI
/// client, the Groq key never enters this app), same session model.
/// Sidebar becomes a mobile drawer instead of a permanent column.
class CoachScreen extends ConsumerStatefulWidget {
  const CoachScreen({super.key});

  @override
  ConsumerState<CoachScreen> createState() => _CoachScreenState();
}

class _CoachScreenState extends ConsumerState<CoachScreen> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  final _inputController = TextEditingController();
  final _inputFocus = FocusNode();
  final _scrollController = ScrollController();

  List<ChatSession> _sessions = [];
  bool _sessionsLoading = true;
  String? _activeSessionId;
  List<ChatMessage> _messages = [];
  bool _loadingSession = false;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(coachApiProvider).fetchSessions().then((s) {
      if (mounted) {
        setState(() {
          _sessions = s;
          _sessionsLoading = false;
        });
      }
    }).catchError((_) {
      if (mounted) setState(() => _sessionsLoading = false);
    });
  }

  @override
  void dispose() {
    _inputController.dispose();
    _inputFocus.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _openSession(String sessionId) async {
    setState(() {
      _error = null;
      _activeSessionId = sessionId;
      _loadingSession = true;
    });
    Navigator.of(context).maybePop();
    try {
      final history = await ref.read(coachApiProvider).fetchMessages(sessionId);
      if (mounted) setState(() => _messages = history);
      _scrollToBottom();
    } finally {
      if (mounted) setState(() => _loadingSession = false);
    }
  }

  void _startNewChat() {
    setState(() {
      _error = null;
      _activeSessionId = null;
      _messages = [];
    });
    Navigator.of(context).maybePop();
  }

  Future<String> _ensureSession() async {
    if (_activeSessionId != null) return _activeSessionId!;
    final session = await ref.read(coachApiProvider).createSession();
    setState(() {
      _activeSessionId = session.id;
      _sessions = [session, ..._sessions];
    });
    return session.id;
  }

  Future<void> _sendMessage([String? text]) async {
    final content = (text ?? _inputController.text).trim();
    if (content.isEmpty || _sending) return;
    setState(() => _error = null);
    _inputController.clear();

    final optimistic = ChatMessage(
      id: 'pending-${DateTime.now().millisecondsSinceEpoch}',
      sessionId: _activeSessionId ?? 'pending',
      role: 'user',
      content: content,
      createdAt: DateTime.now(),
    );
    setState(() {
      _messages = [..._messages, optimistic];
      _sending = true;
    });
    _scrollToBottom();
    try {
      final sessionId = await _ensureSession();
      final reply = await ref.read(coachApiProvider).sendMessage(sessionId, content);
      if (mounted) setState(() => _messages = [..._messages, reply]);
      _scrollToBottom();
      ref.read(coachApiProvider).fetchSessions().then((s) {
        if (mounted) setState(() => _sessions = s);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _weeklyCheckin() async {
    setState(() {
      _error = null;
      _sending = true;
    });
    try {
      final sessionId = await _ensureSession();
      final message = await ref.read(coachApiProvider).requestWeeklyCheckin(sessionId);
      if (mounted) setState(() => _messages = [..._messages, message]);
      _scrollToBottom();
      ref.read(coachApiProvider).fetchSessions().then((s) {
        if (mounted) setState(() => _sessions = s);
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      appBar: AppBar(
        title: const Text('AI Coach', style: TextStyle(fontSize: 17)),
        actions: [
          TextButton(
            onPressed: _sending ? null : _weeklyCheckin,
            child: const Text('Weekly check-in', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
      drawer: Drawer(backgroundColor: AppColors.surface, child: _sidebar()),
      body: Column(
        children: [
          Expanded(
            child: _loadingSession
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? _emptyState()
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length + (_sending ? 1 : 0),
                        itemBuilder: (context, i) {
                          if (i == _messages.length) {
                            return _thinkingBubble();
                          }
                          return _messageBubble(_messages[i]);
                        },
                      ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: Color(0xFFF87171), fontSize: 12)),
            ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _inputController,
                      focusNode: _inputFocus,
                      enabled: !_sending,
                      decoration: const InputDecoration(hintText: 'Ask your coach anything...'),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(
                    onPressed: _sending ? null : () => _sendMessage(),
                    icon: const Icon(Icons.arrow_upward_rounded, size: 18),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sidebar() {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: OutlinedButton.icon(
              onPressed: _startNewChat,
              icon: const Icon(Icons.add_rounded, size: 16),
              label: const Text('New chat'),
              style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.lineStrong)),
            ),
          ),
          Expanded(
            child: _sessionsLoading
                ? const Center(child: CircularProgressIndicator())
                : _sessions.isEmpty
                    ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No past conversations yet.',
                              style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
                        ),
                      )
                    : ListView(
                        children: [
                          for (final s in _sessions)
                            ListTile(
                              selected: s.id == _activeSessionId,
                              selectedTileColor: AppColors.surfaceHover,
                              title: Text(s.title ?? 'New chat',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: AppColors.ink, fontSize: 13)),
                              subtitle: Text(_formatSessionDate(s.updatedAt),
                                  style: const TextStyle(color: AppColors.inkMuted, fontSize: 10)),
                              onTap: () => _openSession(s.id),
                            ),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _messageBubble(ChatMessage m) {
    final isUser = m.role == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isUser ? AppColors.accent : AppColors.bg,
          borderRadius: BorderRadius.circular(12),
          border: isUser ? null : Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (!isUser && m.toolPayload != null) ...[
              ToolResultCard(toolName: m.toolName, payload: m.toolPayload!),
              const Divider(color: AppColors.line, height: 16),
            ],
            if (isUser)
              Text(m.content, style: const TextStyle(color: Colors.white, fontSize: 13))
            else
              MarkdownMessage(content: m.content),
            const SizedBox(height: 4),
            Text(
              _formatTime(m.createdAt),
              style: TextStyle(color: isUser ? Colors.white70 : AppColors.inkMuted, fontSize: 9),
            ),
          ],
        ),
      ),
    );
  }

  Widget _thinkingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.line),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accent),
            ),
            SizedBox(width: 8),
            Text('Thinking...', style: TextStyle(color: AppColors.inkMuted, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  /// Premium fitness-coach empty state — deliberately no chat-bubble icon,
  /// matching the web app's recently-redesigned equivalent.
  Widget _emptyState() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                border: Border.all(color: AppColors.lineStrong),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.fitness_center_rounded, color: AppColors.accent, size: 13),
                  const SizedBox(width: 6),
                  Text('YOUR COACH',
                      style: TextStyle(
                          color: AppColors.inkSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.2)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text('Your training, your data, your coach.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.ink, fontSize: 19, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            const Text('Ask about your workouts, progress, macros, or next session.',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.inkMuted, fontSize: 13)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => _inputFocus.requestFocus(),
              child: const Text('Start a conversation'),
            ),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final prompt in _suggestedPrompts)
                  OutlinedButton(
                    onPressed: () {
                      _inputController.text = prompt;
                      _inputFocus.requestFocus();
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.inkSecondary,
                      side: const BorderSide(color: AppColors.lineStrong),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    child: Text(prompt, style: const TextStyle(fontSize: 11)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
