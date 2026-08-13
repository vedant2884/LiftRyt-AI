// Mirrors backend/app/schemas/chat.py.

class ChatSession {
  final String id;
  final String? title;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ChatSession({required this.id, this.title, required this.createdAt, required this.updatedAt});

  factory ChatSession.fromJson(Map<String, dynamic> json) => ChatSession(
        id: json['id'] as String,
        title: json['title'] as String?,
        createdAt: DateTime.parse(json['created_at'] as String),
        updatedAt: DateTime.parse(json['updated_at'] as String),
      );
}

class ChatMessage {
  final String id;
  final String sessionId;
  final String role;
  final String content;
  final String? toolName;
  final Map<String, dynamic>? toolPayload;
  final DateTime createdAt;

  const ChatMessage({
    required this.id,
    required this.sessionId,
    required this.role,
    required this.content,
    this.toolName,
    this.toolPayload,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        sessionId: json['session_id'] as String,
        role: json['role'] as String,
        content: json['content'] as String,
        toolName: json['tool_name'] as String?,
        toolPayload: json['tool_payload'] as Map<String, dynamic>?,
        createdAt: DateTime.parse(json['created_at'] as String),
      );
}
