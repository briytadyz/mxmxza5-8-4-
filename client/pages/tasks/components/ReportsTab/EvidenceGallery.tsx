import React, { useState } from "react";
import { TaskEvidenceSubmission } from "../../../../lib/supabase";
import FullscreenMediaViewer from "../../../../components/FullscreenMediaViewer";

interface EvidenceGalleryProps {
  evidenceSubmissions: TaskEvidenceSubmission[];
}

const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({ evidenceSubmissions }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const viewerItems = evidenceSubmissions.map((evidence) => ({
    url: evidence.attachments?.b2_url || "",
    type: evidence.attachments?.file_type || "file",
    name: evidence.attachments?.original_name || "Evidence",
    description: evidence.description,
    fileSize: evidence.attachments?.file_size,
    footerLabel: `Submitted: ${new Date(evidence.submitted_at).toLocaleString()}`,
  }));

  // Separate evidence by type for better organization
  const images = evidenceSubmissions.filter((e) => e.attachments?.file_type === "image");
  const videos = evidenceSubmissions.filter((e) => e.attachments?.file_type === "video");
  const documents = evidenceSubmissions.filter((e) => e.attachments?.file_type !== "image" && e.attachments?.file_type !== "video");

  return (
    <>
      {/* Gallery Grid */}
      <div className="space-y-8">
        {/* Images Section */}
        {images.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-sheraton-navy mb-4">📷 Photos</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((evidence, idx) => {
                const globalIdx = evidenceSubmissions.indexOf(evidence);
                return (
                  <div
                    key={evidence.id}
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedIndex(globalIdx)}
                  >
                    <img
                      src={evidence.attachments?.b2_url}
                      alt={evidence.description || "Photo"}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-sheraton-navy mb-4">🎥 Videos</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((evidence) => {
                const globalIdx = evidenceSubmissions.indexOf(evidence);
                return (
                  <div
                    key={evidence.id}
                    className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-black cursor-pointer hover:shadow-lg transition-shadow relative group"
                    onClick={() => setSelectedIndex(globalIdx)}
                  >
                    <video
                      src={evidence.attachments?.b2_url}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-6 border-l-transparent border-r-6 border-r-transparent border-t-10 border-t-sheraton-navy ml-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Documents Section */}
        {documents.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-sheraton-navy mb-4">📄 Documents</h4>
            <div className="space-y-2">
              {documents.map((evidence, idx) => {
                const globalIdx = evidenceSubmissions.indexOf(evidence);
                return (
                  <div
                    key={evidence.id}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="text-2xl">📎</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">
                            {evidence.attachments?.original_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(evidence.attachments?.file_size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      {evidence.description && (
                        <p className="text-sm text-gray-600 ml-2">{evidence.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <FullscreenMediaViewer
        items={viewerItems}
        selectedIndex={selectedIndex}
        onSelectedIndexChange={setSelectedIndex}
      />
    </>
  );
};

export default EvidenceGallery;
