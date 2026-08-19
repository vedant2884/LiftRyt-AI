export type NotificationType = "missed_workout" | "return_reminder" | "streak_alive" | "pr_recent";

export interface AppNotification {
  type: NotificationType;
  message: string;
}
