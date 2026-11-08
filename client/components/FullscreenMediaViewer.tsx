import React from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export interface FullscreenMediaItem {
  url: string;
  type: string;
  name: string;
  description?: string | null;
  fileSize?: number;
  footerLabel?: string;
}

interface FullscreenMediaViewerProps {
  items: FullscreenMediaItem[];
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number | null) => void;
}

const isPdfOrDocument = (filename: string): boolean => {
  const lowerName = filename.toLowerCase();
  return lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx");
};

const FullscreenMediaViewer: React.FC<FullscreenMediaViewerProps> = ({
  items,
  selectedIndex,
  onSelectedIndexChange,
}) => {
  const selectedItem = selectedIndex === null ? null : items[selectedIndex];

  if (!selectedItem) return null;

  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      onSelectedIndexChange(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < items.length - 1) {
      onSelectedIndexChange(selectedIndex + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between border-b border-gray-700 bg-black p-4">
        <div className="flex-1">
          <p className="font-medium text-white">{selectedItem.type.toUpperCase()}</p>
          {selectedItem.description && (
            <p className="text-sm text-gray-400">{selectedItem.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-4 text-sm text-white">
            {selectedIndex + 1} / {items.length}
          </span>
          <button
            onClick={() => onSelectedIndexChange(null)}
            aria-label="Close media viewer"
            className="rounded-lg p-2 transition-colors hover:bg-gray-700"
          >
            <X className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
        {selectedItem.type === "image" ? (
          <img
            src={selectedItem.url}
            alt={selectedItem.description || selectedItem.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : selectedItem.type === "video" ? (
          <video
            src={selectedItem.url}
            controls
            autoPlay
            className="max-h-full max-w-full"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            {isPdfOrDocument(selectedItem.name) ? (
              <>
                <iframe
                  src={`${selectedItem.url}#toolbar=0`}
                  className="h-full w-full border-0"
                  title={selectedItem.name}
                />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/80 px-4 py-2">
                  <a
                    href={selectedItem.url}
                    download={selectedItem.name}
                    className="inline-flex items-center gap-2 text-sheraton-gold transition-colors hover:text-white"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="mb-4 text-6xl">📄</div>
                <p className="mb-2 text-lg text-white">{selectedItem.name}</p>
                {!!selectedItem.fileSize && (
                  <p className="mb-6 text-gray-400">
                    {(selectedItem.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-sheraton-gold px-6 py-3 font-semibold text-sheraton-navy transition-all hover:bg-opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-700 bg-black p-4">
        <button
          onClick={handlePrev}
          disabled={selectedIndex === 0}
          aria-label="Previous attachment"
          className="rounded-lg p-2 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm text-gray-400">
            {selectedItem.footerLabel || `${selectedIndex + 1} / ${items.length}`}
          </p>
        </div>
        <button
          onClick={handleNext}
          disabled={selectedIndex === items.length - 1}
          aria-label="Next attachment"
          className="rounded-lg p-2 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  );
};

export default FullscreenMediaViewer;
