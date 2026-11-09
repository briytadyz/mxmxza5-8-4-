import React from "react";
import {
  AlertCircle,
  Clock,
  Flag,
  CheckCircle,
} from "lucide-react";

interface StatusIconProps {
  status: string;
  className?: string;
}

const StatusIcon: React.FC<StatusIconProps> = ({ status, className = "h-4 w-4" }) => {
  switch (status) {
    case "todo":
      return <AlertCircle className={`${className} text-yellow-600 dark:text-yellow-400`} />;
    case "in_progress":
      return <Clock className={`${className} text-blue-600 dark:text-blue-400`} />;
    case "in_review":
      return <Flag className={`${className} text-purple-600 dark:text-purple-400`} />;
    case "completed":
      return <CheckCircle className={`${className} text-green-600 dark:text-green-400`} />;
    default:
      return null;
  }
};

export default StatusIcon;
