export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case "todo":
      return "bg-white border border-slate-200 border-l-4 border-l-amber-400 shadow-sm";
    case "in_progress":
      return "bg-white border border-slate-200 border-l-4 border-l-blue-500 shadow-sm";
    case "in_review":
      return "bg-white border border-slate-200 border-l-4 border-l-violet-500 shadow-sm";
    case "completed":
      return "bg-white border border-slate-200 border-l-4 border-l-emerald-500 shadow-sm";
    default:
      return "bg-white border border-slate-200 border-l-4 border-l-slate-400 shadow-sm";
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
