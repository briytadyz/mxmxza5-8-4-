import React, { useEffect, useRef, useState } from "react";
import {
  FileText,
  Image,
  Music,
  Video,
  Archive,
  File,
  Download,
  X,
  Paperclip,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import MuxVideoPlayer from "./MuxVideoPlayer";
import FullscreenMediaViewer, { type FullscreenMediaItem } from "./FullscreenMediaViewer";
import { toast } from "../hooks/use-toast";

interface Attachment {
  id?: string;
  attachmentId?: string; // Used by UploadedFile
  name?: string;
  originalName?: string; // Used by UploadedFile
  filename?: string; // Used by UploadedFile (for video uploads)
  type?: string;
  fileType?: string; // Used by UploadedFile
  size?: number;
  fileSize?: number; // Used by UploadedFile
  url?: string;
  publicUrl?: string; // Used by UploadedFile
}

interface AttachmentListProps {
  attachments: Attachment[];
  compact?: boolean;
  popupPlacement?: "top" | "bottom";
  popupAllAttachments?: boolean;
}

// Get icon based on file extension or fileType
const getFileIcon = (fileName: string, fileType?: string) => {
  // Use fileType if provided
  if (fileType) {
    switch (fileType) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'audio':
        return <Music className="h-4 w-4" />;
      case 'file':
      default:
        break;
    }
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Document types
  if (["pdf", "doc", "docx", "txt", "xls", "xlsx", "ppt", "pptx"].includes(ext)) {
    return <FileText className="h-4 w-4" />;
  }

  // Image types
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return <Image className="h-4 w-4" />;
  }

  // Video types
  if (["mp4", "avi", "mov", "mkv", "webm"].includes(ext)) {
    return <Video className="h-4 w-4" />;
  }

  // Audio types
  if (["mp3", "wav", "aac", "flac", "m4a"].includes(ext)) {
    return <Music className="h-4 w-4" />;
  }

  // Archive types
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <Archive className="h-4 w-4" />;
  }

  // Default
  return <File className="h-4 w-4" />;
};

// Format file size
const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

// Get file extension for display
const getFileExtension = (fileName: string) => {
  return fileName.split(".").pop()?.toUpperCase() || "FILE";
};

const AttachmentList: React.FC<AttachmentListProps> = ({ attachments, compact = false, popupPlacement = "bottom", popupAllAttachments = false }) => {
  const [expanded, setExpanded] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [expanded]);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Separate videos from other attachments
  const videos = popupAllAttachments ? [] : attachments.filter(att => {
    const fileType = att.fileType || att.type;
    return fileType === 'video';
  });

  const otherAttachments = popupAllAttachments ? attachments : attachments.filter(att => {
    const fileType = att.fileType || att.type;
    return fileType !== 'video';
  });

  const getFileNameFromAttachment = (attachment: Attachment): string => {
    return attachment.originalName || attachment.filename || attachment.name || "Attachment";
  };

  const getFileSizeFromAttachment = (attachment: Attachment): number | undefined => {
    return attachment.fileSize || attachment.size;
  };

  const getFileUrlFromAttachment = (attachment: Attachment): string => {
    return attachment.publicUrl || attachment.url || "";
  };

  const getFileTypeFromAttachment = (attachment: Attachment): string | undefined => {
    return attachment.fileType || attachment.type;
  };

  const previewItems: FullscreenMediaItem[] = otherAttachments.map((attachment) => ({
    url: getFileUrlFromAttachment(attachment),
    type: getFileTypeFromAttachment(attachment) || "file",
    name: getFileNameFromAttachment(attachment),
    fileSize: getFileSizeFromAttachment(attachment),
  }));

  const handleDownload = async (attachment: Attachment) => {
    const url = getFileUrlFromAttachment(attachment);
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download request failed");

      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = getFileNameFromAttachment(attachment);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch {
      toast({
        title: "Download failed",
        description: "Unable to download this attachment.",
        variant: "destructive",
      });
    }
  };

  if (compact) {
    return (
      <>
      <div className="space-y-3">
        {/* Videos section */}
        {videos.length > 0 && (
          <div className="space-y-2">
            {videos.map((attachment) => {
              const fileName = getFileNameFromAttachment(attachment);
              const videoFilename = attachment.filename || '';
              return (
                <div key={videoFilename} className="w-full">
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-2">{fileName}</p>
                  {videoFilename && <MuxVideoPlayer filename={videoFilename} />}
                </div>
              );
            })}
          </div>
        )}

        {/* Other attachments button */}
        {otherAttachments.length > 0 && (
          <div ref={popupRef} className="flex items-center gap-2 relative">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <Paperclip className="h-3 w-3" />
              {otherAttachments.length} file{otherAttachments.length !== 1 ? "s" : ""}
            </button>

            {expanded && (
              <div className={`absolute z-50 ${popupPlacement === "top" ? "bottom-full mb-2 left-1/2 -translate-x-1/2 w-72" : "top-full mt-2 left-0 w-80"} bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-lg p-4 space-y-2`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-slate-100">Attachments</h4>
                  <button
                    onClick={() => setExpanded(false)}
                    className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {otherAttachments.map((attachment) => {
                  const fileName = getFileNameFromAttachment(attachment);
                  const fileSize = getFileSizeFromAttachment(attachment);
                  const fileType = getFileTypeFromAttachment(attachment);
                  return (
                    <div
                      key={attachment.id || attachment.attachmentId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 text-gray-500 dark:text-slate-400">
                          {getFileIcon(fileName, fileType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setPreviewIndex(otherAttachments.indexOf(attachment))}
                            className="block w-full truncate text-left text-sm font-medium text-gray-900 dark:text-slate-100 hover:underline"
                          >
                            {fileName}
                          </button>
                          {fileSize && (
                            <p className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(fileSize)}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDownload(attachment);
                        }}
                        className="flex-shrink-0 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                        title="Download file"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <FullscreenMediaViewer
        items={previewItems}
        selectedIndex={previewIndex}
        onSelectedIndexChange={setPreviewIndex}
      />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Videos section */}
      {videos.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <Video className="h-4 w-4" />
            Videos ({videos.length})
          </h4>
          <div className="space-y-2">
            {videos.map((attachment) => {
              const fileName = getFileNameFromAttachment(attachment);
              const videoFilename = attachment.filename || '';
              return (
                <div key={videoFilename} className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-slate-300">{fileName}</p>
                  {videoFilename && <MuxVideoPlayer filename={videoFilename} />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Other attachments section */}
      {otherAttachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Files ({otherAttachments.length})
            </h4>
            {otherAttachments.length > 3 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
              >
                {expanded ? "Hide" : "Show"}
              </button>
            )}
          </div>

          {(expanded || otherAttachments.length <= 3) && (
            <div className="space-y-2 bg-gray-50 dark:bg-slate-800 rounded-lg p-3">
              {otherAttachments.map((attachment) => {
                const fileName = getFileNameFromAttachment(attachment);
                const fileSize = getFileSizeFromAttachment(attachment);
                const fileType = getFileTypeFromAttachment(attachment);
                return (
                  <div
                    key={attachment.id || attachment.attachmentId}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 p-2 bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 rounded">
                        {getFileIcon(fileName, fileType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                          {fileName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {getFileExtension(fileName)}
                          </Badge>
                          {fileSize && (
                            <span className="text-xs text-gray-500 dark:text-slate-400">{formatFileSize(fileSize)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDownload(attachment);
                      }}
                      className="flex-shrink-0 ml-2"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {!expanded && otherAttachments.length > 3 && (
            <div className="flex flex-wrap gap-2">
              {otherAttachments.slice(0, 3).map((attachment) => {
                const fileName = getFileNameFromAttachment(attachment);
                const fileType = getFileTypeFromAttachment(attachment);
                return (
                  <Badge key={attachment.id || attachment.attachmentId} variant="outline" className="text-xs">
                    {getFileIcon(fileName, fileType)}
                    <span className="ml-1">{fileName.length > 20 ? fileName.substring(0, 20) + "..." : fileName}</span>
                  </Badge>
                );
              })}
              {otherAttachments.length > 3 && (
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-100" onClick={() => setExpanded(true)}>
                  +{otherAttachments.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttachmentList;
