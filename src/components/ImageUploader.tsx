import React, { useState } from "react";
import { Upload, Loader2 } from "lucide-react";

interface ImageUploaderProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  value, 
  onChange, 
  required = false 
}) => {
  const [uploadMode, setUploadMode] = useState<"url" | "upload">("upload");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const resolveUploadUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("drive.google.com")) {
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/);
      if (match && match[1]) {
        return `/api/drive-proxy?id=${match[1]}`;
      }
    }
    return url;
  };

  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Hanya file gambar (.jpg, .jpeg, .png, .webp) yang diperbolehkan.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Ukuran file tidak boleh melebihi 10MB.");
      return;
    }

    setUploading(true);
    setUploadError("");

    // Attempt direct Google Drive upload if connected
    const googleToken = localStorage.getItem("google_access_token");
    const driveFolderId = "1jyliqBEArRAqSIhjJ6v3gnL7-12bJKCW";

    if (googleToken) {
      try {
        const metadata = {
          name: file.name,
          mimeType: file.type,
          parents: [driveFolderId]
        };

        const form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
        form.append("file", file);

        const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`
          },
          body: form
        });

        if (uploadRes.ok) {
          const fileData = await uploadRes.json();
          const fileId = fileData.id;

          // Set permissions to reader for anyone so the image renders correctly in browser for other users
          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${googleToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              role: "reader",
              type: "anyone"
            })
          });

          const webViewUrl = `https://drive.google.com/uc?id=${fileId}`;
          onChange(webViewUrl);
          setUploading(false);
          return;
        } else {
          console.warn("Gagal mengunggah berkas ke Google Drive, beralih ke server lokal...");
        }
      } catch (err) {
        console.warn("Kesalahan koneksi Google Drive upload, beralih ke server lokal:", err);
      }
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onChange(data.url);
      } else {
        const err = await response.json();
        setUploadError(err.error || "Gagal mengunggah file.");
      }
    } catch (e) {
      setUploadError("Masalah koneksi jaringan dengan server.");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const cleanLabel = label.replace(/\s+/g, '-');

  return (
    <div className="space-y-1.5 text-xs font-sans">
      <div className="flex items-center justify-between">
        <label className="block text-slate-500 font-semibold">{label}</label>
        {required && !value && (
          <span className="text-[10px] text-rose-600 font-bold font-mono uppercase tracking-wider">HARUS DIISI</span>
        )}
      </div>

      <div className="flex items-center space-x-2 pb-1">
        <button
          type="button"
          onClick={() => {
            setUploadMode("upload");
            setUploadError("");
          }}
          className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer border ${
            uploadMode === "upload"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
          }`}
        >
          📂 Upload Berkas Foto
        </button>
        <button
          type="button"
          onClick={() => {
            setUploadMode("url");
            setUploadError("");
          }}
          className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer border ${
            uploadMode === "url"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
          }`}
        >
          🔗 Input URL Gambar
        </button>
      </div>

      {uploadMode === "url" ? (
        <input
          type="text"
          placeholder="Contoh: https://images.unsplash.com/..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
        />
      ) : (
        <div className="space-y-2">
          {value ? (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-2.5 overflow-hidden mr-2">
                <img
                  src={resolveUploadUrl(value)}
                  alt="Review upload"
                  className="h-10 w-10 object-cover rounded-lg border border-slate-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="overflow-hidden">
                  <span className="text-[10px] font-mono text-emerald-700 block truncate font-bold">Terunggah Sukses</span>
                  <p className="text-[9px] text-slate-400 font-mono truncate">{value}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange("")}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-2 py-1 rounded-md text-[10px] font-bold transition flex items-center justify-center shrink-0 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                const fileInput = document.getElementById(`file-input-${cleanLabel}`) as HTMLInputElement;
                if (fileInput) fileInput.click();
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
                dragging
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
              }`}
            >
              <input
                type="file"
                id={`file-input-${cleanLabel}`}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              {uploading ? (
                <>
                  <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />
                  <p className="text-[10px] font-semibold text-slate-500">Mengecek & mengunggah berkas...</p>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-slate-400" />
                  <p className="text-[10px] text-slate-600 font-semibold">
                    Tarik berkas foto di sini, atau <span className="text-emerald-700 underline font-semibold">pilih dokumen</span>
                  </p>
                  <p className="text-[9px] text-slate-400">Tipe Gambar (.png, .jpg, .jpeg, .webp), maks. 10MB</p>
                </>
              )}
            </div>
          )}

          {uploadError && (
            <p className="text-[10px] text-rose-600 bg-rose-50 p-2 border border-rose-100 rounded-md flex items-center gap-1 font-semibold">
              ⚠️ {uploadError}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
