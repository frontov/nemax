export type NotificationSettings = {
  pushEnabled: boolean;
  soundEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
};
