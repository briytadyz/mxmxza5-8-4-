export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    case "low":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200";
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "todo":
      return "bg-card border border-amber-300 dark:border-amber-800 border-l-4 border-l-amber-400 shadow-sm";
    case "in_progress":
      return "bg-card border border-blue-300 dark:border-blue-800 border-l-4 border-l-blue-500 shadow-sm";
    case "in_review":
      return "bg-card border border-violet-300 dark:border-violet-800 border-l-4 border-l-violet-500 shadow-sm";
    case "completed":
      return "bg-card border border-emerald-300 dark:border-emerald-800 border-l-4 border-l-emerald-500 shadow-sm";
    default:
      return "bg-card border border-slate-300 dark:border-slate-700 border-l-4 border-l-slate-400 shadow-sm";
  }
};

export const getStatusIcon = (
  status: string
): "todo" | "in_progress" | "in_review" | "completed" | "unknown" => {
  switch (status) {
    case "todo":
      return "todo";
    case "in_progress":
      return "in_progress";
    case "in_review":
      return "in_review";
    case "completed":
      return "completed";
    default:
      return "unknown";
  }
};

export const getStatusLabel = (status: string): string => {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
