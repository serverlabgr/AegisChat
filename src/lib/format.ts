export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayDivider(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (isToday) return "Σήμερα";
  return date.toLocaleDateString("el-GR", {
    day: "numeric",
    month: "long",
  });
}

export function initials(name: string): string {
  return name.slice(0, 1).toUpperCase();
}
