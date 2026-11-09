import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Loader, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { supabase, TodoListItem, WorkerTaskPayment } from "../lib/supabase";
import { toast } from "../hooks/use-toast";
import AttachmentList from "./AttachmentList";

interface FileAttachment {
  id?: string;
  attachmentId?: string;
  name?: string;
  originalName?: string;
  filename?: string;
  type?: string;
  fileType?: string;
  size?: number;
  fileSize?: number;
  url?: string;
  publicUrl?: string;
}

interface TodoItemProps {
  todo: TodoListItem;
  attachments?: FileAttachment[];
  onStatusChange?: (todoId: string, newStatus: string) => void;
  onCompleted?: () => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  attachments = [],
  onStatusChange,
  onCompleted,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(todo.status);
  const [payment, setPayment] = useState<WorkerTaskPayment | null>(null);

  useEffect(() => {
    let isActive = true;
    supabase
      .from("worker_task_payments")
      .select("task_id, amount, tax_amount, currency_code, worker_currency_code, fx_rate, fx_rate_source, fx_rate_fetched_at, converted_amount, converted_tax_amount, payment_method, payment_reference, paid_at, confirmation_status, worker_acknowledged_at")
      .eq("task_id", todo.task_id)
      .maybeSingle()
      .then(({ data }) => {
        if (isActive) setPayment(data ?? null);
      });
    return () => {
      isActive = false;
    };
  }, [todo.task_id]);

  const getPriorityColor = (priority: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-card border border-amber-300 dark:border-amber-800 border-l-4 border-l-amber-400 shadow-sm";
      case "in_progress":
        return "bg-card border border-blue-300 dark:border-blue-800 border-l-4 border-l-blue-500 shadow-sm";
      case "completed":
        return "bg-card border border-emerald-300 dark:border-emerald-800 border-l-4 border-l-emerald-500 shadow-sm";
      default:
        return "bg-card border border-slate-300 dark:border-slate-700 border-l-4 border-l-slate-400 shadow-sm";
    }
  };

  const getMetadataTone = (status: string) => {
    switch (status) {
      case "pending":
        return { panel: "bg-amber-50/70 dark:bg-amber-950/30", label: "text-amber-700 dark:text-amber-300", titleHover: "group-hover:text-amber-700 dark:group-hover:text-amber-300" };
      case "in_progress":
        return { panel: "bg-blue-50/70 dark:bg-blue-950/30", label: "text-blue-700 dark:text-blue-300", titleHover: "group-hover:text-blue-700 dark:group-hover:text-blue-300" };
      case "completed":
        return { panel: "bg-emerald-50/70 dark:bg-emerald-950/30", label: "text-emerald-700 dark:text-emerald-300", titleHover: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300" };
      default:
        return { panel: "bg-slate-50/80 dark:bg-slate-800", label: "text-slate-500 dark:text-slate-300", titleHover: "group-hover:text-slate-600 dark:group-hover:text-slate-200" };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
      default:
        return null;
    }
  };

  const handleStatusChange = async (newStatus: TodoListItem["status"]) => {
    setIsUpdating(true);
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
      };

      // If marking as completed, set completed_at
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("todo_list")
        .update(updateData)
        .eq("id", todo.id);

      if (error) throw error;

      setStatus(newStatus);
      onStatusChange?.(todo.id, newStatus);

      toast({
        title: "Updated",
        description:
          newStatus === "completed"
            ? "Task marked as completed! Great work!"
            : `Task moved to ${newStatus.replace("_", " ")}`,
      });

      if (newStatus === "completed") {
        onCompleted?.();
      }
    } catch (error) {
      console.error("Error updating todo status:", error);

      // Provide helpful error messages
      let errorMessage = "Failed to update todo";
      if (error instanceof Error) {
        if (error.message.includes("foreign key") || error.message.includes("23503")) {
          errorMessage = "There's a data consistency issue. Please try refreshing the page and try again.";
        } else if (error.message.includes("permission") || error.message.includes("RLS")) {
          errorMessage = "You don't have permission to update this task.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setStatus(todo.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const isOverdue =
    todo.due_date && new Date(todo.due_date) < new Date() && status !== "completed";
  const metadataTone = getMetadataTone(status);

  return (
    <Card className={`${getStatusColor(status)} group rounded-xl`}>
      <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              Task #{todo.task_id.slice(0, 8)}
            </p>
            <div className="flex flex-shrink-0 items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              {getStatusIcon(status)}
              <span>{status === "in_progress" ? "In Progress" : status === "completed" ? "Completed" : "Pending"}</span>
            </div>
          </div>
          <div className="min-w-0">
            <CardTitle className={`text-base text-sheraton-navy dark:text-slate-100 line-clamp-2 transition-colors duration-200 ${metadataTone.titleHover}`}>
              {todo.title}
            </CardTitle>
            {todo.description && (
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-1 line-clamp-2">
                {todo.description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
        <div className={`grid grid-cols-2 gap-x-5 gap-y-4 rounded-xl ${metadataTone.panel} p-4`}>
          {todo.due_date && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Due Date
              </p>
              <p className={`mt-1.5 text-sm font-semibold ${isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-800 dark:text-slate-100"}`}>
                {new Date(todo.due_date).toLocaleDateString()}
              </p>
              {isOverdue && (
                <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  Overdue
                </p>
              )}
            </div>
          )}

          {todo.details?.budget && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Budget
              </p>
              <p className="mt-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                ${todo.details.budget.toFixed(2)}
              </p>
            </div>
          )}

          {todo.details?.category && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Category
              </p>
              <p className="mt-1.5 text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
                {todo.details.category}
              </p>
            </div>
          )}

          {todo.details?.estimated_time && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Est. Time
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {todo.details.estimated_time}
              </p>
            </div>
          )}

          {todo.estimated_hours && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Est. Hours
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {todo.estimated_hours.toFixed(1)}h
              </p>
            </div>
          )}

          {todo.details?.payment_terms && (
            <div className="min-w-0">
              <p className={`text-sm font-semibold tracking-wide ${metadataTone.label}`}>
                Payment Terms
              </p>
              <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {todo.details.payment_terms}
              </p>
            </div>
          )}
        </div>

        {/* Attachments Section */}
        {attachments && attachments.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 uppercase mb-3">
              📎 Attachments ({attachments.length})
            </p>
            <AttachmentList attachments={attachments} compact={true} />
          </div>
        )}

        {/* Status Update Section */}
        <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
              Task Status
            </p>
            <Badge className={`${getPriorityColor(todo.priority)} flex-shrink-0 capitalize`}>
              {todo.priority} Priority
            </Badge>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={(value) => {
                if (value === "pending" || value === "in_progress" || value === "completed") void handleStatusChange(value);
              }} disabled={isUpdating || status === "completed"}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span>Pending</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      <span>In Progress</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {isUpdating && (
                <Loader className="h-4 w-4 animate-spin text-sheraton-gold" />
              )}
            </div>

            {status !== "completed" && (
              <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                Once you complete the work, use the Reports tab to submit evidence and request approval from the manager.
              </p>
            )}
          </div>
        </div>

        {/* Completion Info */}
        {status === "completed" && todo.completed_at && (
          <div className="p-3 bg-green-100/50 dark:bg-emerald-950/30 rounded border border-green-300 dark:border-emerald-800 text-sm">
            <p className="text-green-800 dark:text-green-300 font-semibold">
              ✓ Completed on {new Date(todo.completed_at).toLocaleDateString()}
            </p>
          </div>
        )}

        {payment && (
          <div className={`p-3 rounded border text-sm space-y-1 ${payment.confirmation_status === "pending_confirmation" ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800" : "bg-green-100/50 border-green-300 dark:bg-emerald-950/30 dark:border-emerald-800"}`}>
            <p className={`font-semibold ${payment.confirmation_status === "pending_confirmation" ? "text-amber-900 dark:text-amber-200" : "text-green-800 dark:text-green-300"}`}>
              {payment.confirmation_status === "pending_confirmation" ? "Payment recorded by hotel · confirmation needed" : "Payment received"} · {payment.amount.toLocaleString()} {payment.currency_code} on {new Date(payment.paid_at).toLocaleDateString()}
            </p>
            {payment.confirmation_status === "pending_confirmation" && <p className="text-amber-900 dark:text-amber-200">Confirm receipt in Books to receive the payment receipt.</p>}
            {payment.tax_amount > 0 && (
              <p className={payment.confirmation_status === "pending_confirmation" ? "text-amber-900 dark:text-amber-200" : "text-green-800 dark:text-green-300"}>VAT included: {payment.tax_amount.toLocaleString()} {payment.currency_code}</p>
            )}
            {payment.worker_currency_code && payment.worker_currency_code !== payment.currency_code && payment.converted_amount !== null && payment.fx_rate !== null && (
              <p className={payment.confirmation_status === "pending_confirmation" ? "text-amber-900 dark:text-amber-200" : "text-green-800 dark:text-green-300"}>
                {payment.confirmation_status === "pending_confirmation" ? "Worker Books amount after confirmation" : "In your Books"}: {payment.converted_amount.toLocaleString()} {payment.worker_currency_code} at {payment.fx_rate.toLocaleString(undefined, { maximumFractionDigits: 6 })} per {payment.currency_code}
              </p>
            )}
            <p className={payment.confirmation_status === "pending_confirmation" ? "text-amber-900 dark:text-amber-200" : "text-green-800 dark:text-green-300"}>Reference: {payment.payment_reference}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TodoItem;
