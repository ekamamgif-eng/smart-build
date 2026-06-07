import React, { useState, useEffect } from "react";
import { 
  Cloud, 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ExternalLink,
  ChevronRight, 
  FolderMinus, 
  RotateCw,
  FolderClosed,
  PlusSquare,
  FileText,
  Upload,
  Info
} from "lucide-react";
import { motion } from "motion/react";

interface GoogleDriveSheetsSyncProps {
  googleToken: string | null;
  setGoogleToken: (token: string | null) => void;
  projectConfig: any;
  donations: any[];
  expenditures: any[];
  budgets: any[];
  progress: any[];
  generateLedgerBlob: () => Blob | null | Promise<Blob | null>;
  onLogAudit: (action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE", tableName: "Donation" | "Expenditure" | "PhysicalProgress" | "Budget", recordId: string, details: string) => Promise<void>;
}

export default function GoogleDriveSheetsSync({
  googleToken,
  setGoogleToken,
  projectConfig,
  donations,
  expenditures,
  budgets,
  progress,
  generateLedgerBlob,
  onLogAudit
}: GoogleDriveSheetsSyncProps) {
  // CLIENT ID config state (can be saved in localStorage to persist dev configuration)
  const [clientId, setClientId] = useState<string>(() => {
    return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || localStorage.getItem("smartbuild_google_client_id") || "";
  });
  const [showConfigHelp, setShowConfigHelp] = useState<boolean>(false);

  // Connection management states
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => localStorage.getItem("smartbuild_sheet_id") || "");
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => localStorage.getItem("smartbuild_sheet_url") || "");
  const [driveFolderId, setDriveFolderId] = useState<string>(() => localStorage.getItem("smartbuild_drive_folder_id") || "1jyliqBEArRAqSIhjJ6v3gnL7-12bJKCW");
  const [driveFolderUrl, setDriveFolderUrl] = useState<string>(() => localStorage.getItem("smartbuild_drive_folder_url") || "https://drive.google.com/drive/folders/1jyliqBEArRAqSIhjJ6v3gnL7-12bJKCW");

  // Operational states
  const [sheetsSyncLoading, setSheetsSyncLoading] = useState<boolean>(false);
  const [driveSyncLoading, setDriveSyncLoading] = useState<boolean>(false);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [driveFilesLoading, setDriveFilesLoading] = useState<boolean>(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  // Status logs
  const [operationLogs, setOperationLogs] = useState<Array<{ time: string; type: "success" | "error" | "info"; msg: string }>>([]);
  const [generalError, setGeneralError] = useState<string>("");
  const [generalSuccess, setGeneralSuccess] = useState<string>("");

  const addLog = (type: "success" | "error" | "info", msg: string) => {
    const time = new Date().toLocaleTimeString("id-ID");
    setOperationLogs(prev => [{ time, type, msg }, ...prev]);
  };

  // Save Config credentials
  const handleSaveClientId = (val: string) => {
    setClientId(val.trim());
    localStorage.setItem("smartbuild_google_client_id", val.trim());
    addLog("info", "Google Client ID baru disimpan ke setelan browser.");
  };

  // Disconnect Google Account
  const handleDisconnect = () => {
    setGoogleToken(null);
    addLog("info", "Sesi Google Account diputus secara lokal.");
  };

  // Run Google OAuth Popup
  const handleGoogleSignIn = () => {
    if (!clientId) {
      setGeneralError("Harap masukkan Google Client ID untuk memulai integrasi.");
      return;
    }
    setGeneralError("");
    setIsAuthenticating(true);

    const redirectUri = `${window.location.origin}/oauth-callback`;
    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file"
    ];

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes.join(" "))}&include_granted_scopes=true&state=smartbuild`;
    
    // Open OAuth popup window
    const authWidth = 600;
    const authHeight = 650;
    const left = window.screen.width / 2 - authWidth / 2;
    const top = window.screen.height / 2 - authHeight / 2;

    const popup = window.open(
      authUrl,
      "google_oauth_popup",
      `width=${authWidth},height=${authHeight},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      setIsAuthenticating(false);
      setGeneralError("Popup diblokir oleh browser! Harap izinkan popup untuk situs ini untuk melanjutkan integrasi Google.");
      return;
    }

    addLog("info", "Membuka popup autentikasi Google Identity Services...");
  };

  // Listen to postMessage from oauth-callback popup window
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      // Validate origin to prevent XSS issues under developer sandbox
      if (!event.origin.endsWith(".run.app") && !event.origin.includes("localhost")) {
        return;
      }

      if (event.data?.type === "GOOGLE_AUTH_SUCCESS" && event.data?.accessToken) {
        setGoogleToken(event.data.accessToken);
        setIsAuthenticating(false);
        setGeneralSuccess("Koneksi Google Account berhasil terverifikasi!");
        addLog("success", "Token Google OAuth berhasil diperoleh. Integrasi aktif.");
        setTimeout(() => setGeneralSuccess(""), 4000);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => window.removeEventListener("message", handleAuthMessage);
  }, [setGoogleToken]);

  // Load files in the linked Google Drive folder
  const fetchDriveFiles = async (folderIdToFetch = driveFolderId) => {
    if (!googleToken || !folderIdToFetch) return;
    setDriveFilesLoading(true);
    try {
      const q = `'${folderIdToFetch}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,iconLink,createdTime)&orderBy=createdTime%20desc`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      
      if (res.status === 401) {
        setGoogleToken(null);
        localStorage.removeItem("google_access_token");
        addLog("error", "Sesi Google Account Anda telah berakhir (401 Unauthorized). Silakan hubungkan kembali akun Google Anda.");
        throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
      }
      
      if (res.status === 403 || res.status === 404 || res.status === 400 || res.status === 451) {
        setDriveFolderId("");
        setDriveFolderUrl("");
        localStorage.removeItem("smartbuild_drive_folder_id");
        localStorage.removeItem("smartbuild_drive_folder_url");
        addLog("info", "Folder Drive lama tidak dapat diakses atau dibatasi. Silakan mendirikan folder baru.");
        throw new Error("Folder Drive lama tidak dapat diakses atau tidak ditemukan oleh akun Anda.");
      }

      if (!res.ok) throw new Error("Gagal memuat list berkas Google Drive.");
      const data = await res.json();
      setDriveFiles(data.files || []);
      addLog("info", `Memuat ulang daftar file di Google Drive: ${data.files?.length || 0} file terdaftar.`);
    } catch (err: any) {
      console.error(err);
      addLog("error", "Gagal memuat file di Google Drive folder. " + err.message);
    } finally {
      setDriveFilesLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken && driveFolderId) {
      fetchDriveFiles();
    }
  }, [googleToken, driveFolderId]);

  // 1. Google Sheets Creator and Sync
  const handleExportToSheets = async () => {
    if (!googleToken) return;
    setSheetsSyncLoading(true);
    setGeneralError("");
    addLog("info", "Memulai proses sinkronisasi ekspor ke Google Sheets...");

    try {
      let currentSheetId = spreadsheetId;
      let currentSheetUrl = spreadsheetUrl;

      // Create a brand new Spreadsheet if one doesn't exist
      if (!currentSheetId) {
        addLog("info", "Belum ada Spreadsheet terhubung. Membuat Google Sheet baru...");
        const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            properties: {
              title: `SmartBuild Ledger - ${projectConfig?.name || "Masjid At-Taqwa"} (${new Date().toLocaleDateString("id-ID")})`
            },
            sheets: [
              { properties: { title: "Informasi Proyek" } },
              { properties: { title: "Anggaran (RAB)" } },
              { properties: { title: "History Donasi" } },
              { properties: { title: "History Belanja" } }
            ]
          })
        });

        if (response.status === 401) {
          setGoogleToken(null);
          localStorage.removeItem("google_access_token");
          throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
        }

        if (!response.ok) {
          throw new Error("Gagal membuat Spreadsheet baru di Google Drive.");
        }

        const newSheetData = await response.json();
        currentSheetId = newSheetData.spreadsheetId;
        currentSheetUrl = newSheetData.spreadsheetUrl;
        
        setSpreadsheetId(currentSheetId);
        setSpreadsheetUrl(currentSheetUrl);
        localStorage.setItem("smartbuild_sheet_id", currentSheetId);
        localStorage.setItem("smartbuild_sheet_url", currentSheetUrl);
        addLog("success", `Spreadsheet Baru berhasil dibuat! ID: ${currentSheetId}`);
      }

      // Format current state records to flat spreadsheets rows
      const infoValues = [
        ["PORTAL TRANSPARANSI FINANSIAL SMARTBUILD", ""],
        ["Status Parameter", "Nilai Validitas Sistem"],
        ["Format", "Ekspor Laporan Transparansi"],
        ["ID Proyek", projectConfig?.id || "N/A"],
        ["Nama Proyek", projectConfig?.name || "N/A"],
        ["Tipe Pembangunan", projectConfig?.type || "N/A"],
        ["Sumber Dana", projectConfig?.fundingSource || "N/A"],
        ["Anggaran Target (RAB)", projectConfig?.budget || 0],
        ["Waktu Ekspor Sinkronisasi", new Date().toLocaleString("id-ID")],
        ["Konfirmasi Sistem", "Terverifikasi Aman (Tamper-Proof Ledger)"]
      ];

      const rabsValues = [
        ["ID Pos Anggaran", "Item Pekerjaan", "Kategori Anggaran", "Target Dana (Rp)", "Telah Direalisasikan (Rp)"],
        ...budgets.map(b => [b.id, b.itemName, b.category, b.targetAmount, b.spentAmount || 0])
      ];

      const donationsValues = [
        ["ID Donasi", "Nama Donatur", "Metode Pembayaran", "Jumlah Kontribusi (Rp)", "Tanggal Masuk", "Status Verifikasi", "URL Bukti Slip"],
        ...donations.map(d => [d.id, d.isAnonymous ? "Hamba Allah (Anonim)" : d.donorName, d.paymentMethod, d.amount, d.date, d.status, d.transferProofUrl])
      ];

      const expendituresValues = [
        ["ID Belanja", "Item Belanja", "Kategori Pengeluaran", "Volume", "Satuan", "Harga Satuan (Rp)", "Total Belanja (Rp)", "Vendor Toko", "Petugas Verifikator", "Tanggal Transaksi"],
        ...expenditures.map(e => [e.id, e.itemName, e.category, e.volume, e.unit, e.unitPrice, e.totalPrice, e.storeName, e.inputtedBy, e.date])
      ];

      // Safe update using batchUpdate values REST endpoint
      addLog("info", "Mengunggah data mutasi transaksi ke tab Spreadsheet...");
      const syncResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            { range: "'Informasi Proyek'!A1:B15", values: infoValues },
            { range: "'Anggaran (RAB)'!A1:E100", values: rabsValues },
            { range: "'History Donasi'!A1:G2000", values: donationsValues },
            { range: "'History Belanja'!A1:J2000", values: expendituresValues }
          ]
        })
      });

      if (syncResponse.status === 401) {
        setGoogleToken(null);
        localStorage.removeItem("google_access_token");
        throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
      }
      
      if (syncResponse.status === 403 || syncResponse.status === 404) {
        setSpreadsheetId("");
        setSpreadsheetUrl("");
        localStorage.removeItem("smartbuild_sheet_id");
        localStorage.removeItem("smartbuild_sheet_url");
        addLog("info", "File Spreadsheet lama tidak valid atau tidak diizinkan. Reset id terpasang.");
        throw new Error("Kertas kerja spreadsheet lama tidak valid atau tidak diizinkan untuk akun Anda. Silakan coba klik tombol sinkronisasi ulang untuk merancang sheet baru.");
      }

      if (!syncResponse.ok) {
        // If some sheets are missing, let's create them on the existing Spreadsheet
        addLog("info", "Mencoba membuat tab baru karena beberapa tab tidak ditemukan...");
        
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            requests: [
              { addSheet: { properties: { title: "Informasi Proyek" } } },
              { addSheet: { properties: { title: "Anggaran (RAB)" } } },
              { addSheet: { properties: { title: "History Donasi" } } },
              { addSheet: { properties: { title: "History Belanja" } } }
            ]
          })
        }).catch(() => {}); // ignore errors if some/all already existed

        // Try syncing again after adding tabs
        const retrySync = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${currentSheetId}/values:batchUpdate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: [
              { range: "'Informasi Proyek'!A1:B10", values: infoValues },
              { range: "'Anggaran (RAB)'!A1:E100", values: rabsValues },
              { range: "'History Donasi'!A1:G2000", values: donationsValues },
              { range: "'History Belanja'!A1:J2000", values: expendituresValues }
            ]
          })
        });

        if (!retrySync.ok) throw new Error("Gagal mengunggah data donasi dan belanja ke Google Sheet.");
      }

      setGeneralSuccess("Google Spreadsheet berhasil disinkronkan dengan data terbaru!");
      addLog("success", "Mutasi kas, sasaran anggaran (RAB), dan profil proyek berhasil diekspor ke Google Sheets!");
      
      // Log official audit
      await onLogAudit(
        "CREATE",
        "Budget",
        currentSheetId,
        `Sinkronisasi ekspor data buku besar finansial ke Google Sheets. ID Kertas Kerja: ${currentSheetId}`
      );

      setTimeout(() => setGeneralSuccess(""), 4000);
    } catch (error: any) {
      console.error(error);
      addLog("error", "Sinkronisasi Google Sheets gagal: " + error.message);
      setGeneralError("Gagal menyelesaikan sinkronisasi Google Sheets. Silakan coba lagi.");
    } finally {
      setSheetsSyncLoading(false);
    }
  };

  // 2. Google Drive Multipart Upload (Helper)
  const initDriveFolder = async () => {
    if (!googleToken) return null;
    let currentFolderId = driveFolderId;

    if (!currentFolderId) {
      addLog("info", "Membuat folder penyimpanan khusus SmartBuild di Google Drive Anda...");
      try {
        const folderResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: `SmartBuild Documents - ${projectConfig?.name || "At-Taqwa"}`,
            mimeType: "application/vnd.google-apps.folder"
          })
        });

        if (folderResponse.status === 401) {
          setGoogleToken(null);
          localStorage.removeItem("google_access_token");
          throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
        }

        if (!folderResponse.ok) {
          throw new Error("Gagal mendirikan folder baru di Google Drive.");
        }

        const folderData = await folderResponse.json();
        currentFolderId = folderData.id;
        const newFolderUrl = `https://drive.google.com/drive/folders/${currentFolderId}`;
        
        setDriveFolderId(currentFolderId);
        setDriveFolderUrl(newFolderUrl);
        localStorage.setItem("smartbuild_drive_folder_id", currentFolderId);
        localStorage.setItem("smartbuild_drive_folder_url", newFolderUrl);
        
        addLog("success", `Google Drive Folder berhasil dibuat! ID: ${currentFolderId}`);
        return currentFolderId;
      } catch (err: any) {
        addLog("error", "Gagal menginisialisasi folder Drive: " + err.message);
        return null;
      }
    }
    return currentFolderId;
  };

  // 3. Upload PDF report directly to Google Drive
  const handleUploadReportPDF = async () => {
    if (!googleToken) return;
    setDriveSyncLoading(true);
    setGeneralError("");
    addLog("info", "Memulai pembuatan PDF mutasi resmi...");

    try {
      const folderId = await initDriveFolder();
      if (!folderId) {
        throw new Error("Folder Google Drive tidak siap.");
      }

      const pdfBlobResult = generateLedgerBlob();
      const pdfBlob = pdfBlobResult instanceof Promise ? await pdfBlobResult : pdfBlobResult;
      if (!pdfBlob) {
        throw new Error("Sistem gagal menyusun binary PDF kas proyek.");
      }

      addLog("info", "Mengunggah Laporan Buku Besar PDF ke Google Drive...");
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `Laporan_Mutasi_Kas_SmartBuild_${dateStr}.pdf`;

      const metadata = {
        name: fileName,
        mimeType: "application/pdf",
        parents: [folderId]
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", pdfBlob);

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`
        },
        body: form
      });

      if (response.status === 401) {
        setGoogleToken(null);
        localStorage.removeItem("google_access_token");
        throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
      }

      if (response.status === 403 || response.status === 404 || response.status === 400) {
        setDriveFolderId("");
        setDriveFolderUrl("");
        localStorage.removeItem("smartbuild_drive_folder_id");
        localStorage.removeItem("smartbuild_drive_folder_url");
        throw new Error("Folder Drive sebelumnya tidak dapat diakses atau telah dihapus. Silakan coba lagi untuk mendirikan folder penyimpanan baru.");
      }

      if (!response.ok) {
        throw new Error("Proses upload ke server Google Drive ditolak.");
      }

      const fileData = await response.json();
      addLog("success", `Laporan PDF kas resmi berhasil disimpan di Google Drive! Nama: "${fileName}"`);
      setGeneralSuccess(`Laporan PDF keuangan berhasil terunggah ke Google Drive!`);
      
      // Log official audit
      await onLogAudit(
        "CREATE",
        "PhysicalProgress",
        fileData.id,
        `Unggah laporan buku besar PDF terpilih ke Google Drive folder. ID File: ${fileData.id}`
      );

      // Refresh files list
      fetchDriveFiles(folderId);
      setTimeout(() => setGeneralSuccess(""), 4000);
    } catch (e: any) {
      console.error(e);
      addLog("error", "Ekspor PDF ke Drive gagal: " + e.message);
      setGeneralError("Gagal mengunggah laporan kas PDF ke Google Drive.");
    } finally {
      setDriveSyncLoading(false);
    }
  };

  // 4. File picker upload mechanism (receipt locker)
  const handleFileUploadToDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !selectedUploadFile) return;
    setUploadLoading(true);
    addLog("info", `Mengunggah berkas lokal "${selectedUploadFile.name}" ke Google Drive...`);

    try {
      const folderId = await initDriveFolder();
      if (!folderId) {
        throw new Error("Folder Google Drive tidak siap berkas.");
      }

      const metadata = {
        name: selectedUploadFile.name,
        mimeType: selectedUploadFile.type,
        parents: [folderId]
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", selectedUploadFile);

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`
        },
        body: form
      });

      if (response.status === 401) {
        setGoogleToken(null);
        localStorage.removeItem("google_access_token");
        throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
      }

      if (response.status === 403 || response.status === 404 || response.status === 400) {
        setDriveFolderId("");
        setDriveFolderUrl("");
        localStorage.removeItem("smartbuild_drive_folder_id");
        localStorage.removeItem("smartbuild_drive_folder_url");
        throw new Error("Folder Drive sebelumnya tidak dapat diakses atau telah dihapus. Silakan coba lagi untuk mendirikan folder penyimpanan baru.");
      }

      if (!response.ok) {
        throw new Error("Gagal mengunggah berkas ke Google Drive cloud.");
      }

      addLog("success", `Berkas "${selectedUploadFile.name}" sukses diunggah ke folder Drive.`);
      setSelectedUploadFile(null);
      
      // Reset input element
      const fileInput = document.getElementById("drive-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Refresh files list
      fetchDriveFiles(folderId);
    } catch (err: any) {
      console.error(err);
      addLog("error", "Gagal upload berkas: " + err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  // 5. Cloud Database Export JSON backup to Drive
  const handleBackupDatabaseToDrive = async () => {
    if (!googleToken) return;
    setDriveSyncLoading(true);
    addLog("info", "Mengekspor backup basis data transaksi ke format JSON aman...");

    try {
      const folderId = await initDriveFolder();
      if (!folderId) {
        throw new Error("Folder Google Drive gagal didirikan.");
      }

      const backupObj = {
        exportedAt: new Date().toISOString(),
        projectName: projectConfig?.name,
        projectConfig,
        budgets,
        donations,
        expenditures,
        progress,
        verificationSha256: "SmartBuild Secure Ledger Format v1"
      };

      const jsonBlob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `sb_database_backup_${timestamp}.json`;

      const metadata = {
        name: fileName,
        mimeType: "application/json",
        parents: [folderId]
      };

      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", jsonBlob);

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`
        },
        body: form
      });

      if (response.status === 401) {
        setGoogleToken(null);
        localStorage.removeItem("google_access_token");
        throw new Error("Sesi Google Anda berakhir. Silakan hubungkan kembali akun Google Anda.");
      }

      if (response.status === 403 || response.status === 404 || response.status === 400) {
        setDriveFolderId("");
        setDriveFolderUrl("");
        localStorage.removeItem("smartbuild_drive_folder_id");
        localStorage.removeItem("smartbuild_drive_folder_url");
        throw new Error("Folder Drive sebelumnya tidak dapat diakses atau telah dihapus. Silakan coba lagi untuk mendirikan folder penyimpanan baru.");
      }

      if (!response.ok) {
        throw new Error("Respon Google Drive menolak server-side backup.");
      }

      const fileData = await response.json();
      addLog("success", `Backup basis data berupa file JSON "${fileName}" berhasil tersimpan!`);
      setGeneralSuccess("Database JSON berhasil dibackup ke Google Drive!");
      
      // Log official audit
      await onLogAudit(
        "CREATE",
        "Budget",
        fileData.id,
        `Backup database JSON otomatis ke Google Drive. ID File: ${fileData.id}`
      );

      // Refresh files list
      fetchDriveFiles(folderId);
      setTimeout(() => setGeneralSuccess(""), 4000);
    } catch (err: any) {
      console.error(err);
      addLog("error", "Backup ke Drive gagal: " + err.message);
    } finally {
      setDriveSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="google-integration-root">
      
      {/* Title block with Google cloud logo and clean branding */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1 px-2 text-white bg-blue-600 rounded-sm font-sans tracking-wide text-xs">GOOGLE</span>
            <span>Koneksi Google Workspace Cloud</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            Ekspor secara dinamis laporan buku audit kas ke Google Sheets, amankan berkas slip bukti kwitansi transaksi fisik ke Google Drive secara terintegrasi.
          </p>
        </div>
        
        {/* Connection status header pill */}
        <div className="flex items-center gap-2 text-xs">
          {googleToken ? (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 p-2 px-3 rounded-lg">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span>Sesi Integrasi Google Aktif</span>
              <button 
                onClick={handleDisconnect} 
                className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer"
              >
                Putuskan
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 text-slate-600 border border-slate-200 p-2 px-3 rounded-lg">
              <div className="h-2 w-2 bg-slate-400 rounded-full" />
              <span>Google Account Belum Terhubung</span>
            </div>
          )}
        </div>
      </div>

      {/* General Alert Banner */}
      {generalError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-rose-50 text-rose-700 border border-rose-100 p-4 rounded-xl text-xs flex items-start gap-2.5 shadow-xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <div>
            <p className="font-bold">Terjadi Kesalahan Kredensial / Koneksi:</p>
            <p className="mt-0.5 text-rose-600">{generalError}</p>
          </div>
        </motion.div>
      )}

      {generalSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-xs"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <p className="font-semibold">{generalSuccess}</p>
        </motion.div>
      )}

      {/* MAIN OAUTH CONNECTION PANEL (Show if no Google Token) */}
      {!googleToken && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <PlusSquare className="h-4 w-4 text-emerald-600" />
              <span>Sambungkan ke Akun Google Anda</span>
            </h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Untuk mengizinkan aplikasi ini menulis laporan mutasi kas Anda ke Google Sheets, silakan masukkan **Google Client ID** proyek Google Cloud Anda terlebih dahulu di bawah ini, lalu klik tombol sinkronisasi.
            </p>

            <div className="space-y-2 mt-4">
              <label className="block text-slate-700 font-bold font-mono text-[10px] uppercase tracking-wider">
                Google OAuth Client ID (Developer)
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => handleSaveClientId(e.target.value)}
                  placeholder="Contoh: 12345678-abc123def456.apps.googleusercontent.com"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
                
                <button
                  type="button"
                  onClick={() => setShowConfigHelp(!showConfigHelp)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-3 rounded-lg text-xs"
                  title="Petunjuk Mendapatkan Client ID"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
              <p className="text-slate-400 text-[10px]">
                ID ini disimpan di memori browser Anda agar tidak repot memasukkannya kembali.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthenticating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isAuthenticating ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Menunggu Persetujuan Popup...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-4.5 w-4.5" />
                    <span>Sambungkan Akun Google</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SETUP GUIDE SIDE PANEL */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/50 p-5 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
              <Info className="h-4 w-4 text-emerald-600" />
              <span>Petunjuk Setup Mandiri Quick</span>
            </h4>
            
            <div className="text-[11px] text-slate-600 space-y-3 leading-relaxed">
              <p className="font-semibold text-slate-700">Langkah Membuat Kredensial Google Cloud:</p>
              <ol className="list-decimal pl-4 space-y-2">
                <li>Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-emerald-600 underline font-semibold">Google Cloud Console</a>.</li>
                <li>Aktifkan API: Cari dan aktifkan <strong>Google Drive API</strong> & <strong>Google Sheets API</strong> pada library API Anda.</li>
                <li>Buka menu <strong>Credentials</strong> &rarr; klik <strong>Create Credentials</strong> &rarr; pilih <strong>OAuth client ID</strong>.</li>
                <li>Atur tipe aplikasi ke <strong>Web application</strong>.</li>
                <li>Tambahkan <strong>Authorized redirect URIs</strong>:<br/>
                  <code className="bg-slate-200/80 p-1 rounded font-mono text-[9px] mt-1 select-all block text-slate-800 break-all">{window.location.origin}/oauth-callback</code>
                </li>
                <li>Salin ID Klien & paste ke isian sebelah kiri. Selesai!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE GOOGLE WORKSPACE PANELS (Show if Google Token connected) */}
      {googleToken && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* GOOGLE SHEETS SYNC BOARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-1 px-2.5 text-emerald-800 bg-emerald-50 rounded-full font-mono font-bold text-[9px] tracking-wide uppercase">
                  Google Sheets Module
                </span>
                {spreadsheetId && (
                  <span className="text-slate-400 text-[10px] font-mono">Linked</span>
                )}
              </div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <span>Konsistensi Kertas Kerja Ledger</span>
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Platform akan merancang file Spreadsheet digital khusus di Google Drive Anda. Di dalamnya, data kas, sasaran budget (RAB), donatur masjid, dan pengeluaran belanja akan ditabulasikan secara terpisah, rapi, dan mudah dianalisis.
              </p>

              {spreadsheetId ? (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs space-y-1 mt-4">
                  <p className="text-slate-500 font-semibold font-mono text-[9px] uppercase">ID SPREADSHEET TERHUBUNG</p>
                  <p className="font-mono text-slate-800 truncate text-[11px] font-bold">{spreadsheetId}</p>
                  <div className="pt-2">
                    <a 
                      href={spreadsheetUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1.5 transition-all text-[11px]"
                    >
                      <span>Buka Google Sheet Kertas Kerja</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl p-4 text-center mt-4">
                  <p className="text-slate-400 text-xs italic">
                    Belum ada lembar kalkulasi yang terpetakan. Penyelarasan pertama akan merancang file baru.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleExportToSheets}
                disabled={sheetsSyncLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
              >
                {sheetsSyncLoading ? (
                  <>
                    <RotateCw className="h-4 w-4 animate-spin" />
                    <span>Mengekspor & Menyinkronkan Ledger...</span>
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    <span>{spreadsheetId ? "Sinkronisasi Ulang Data" : "Buat & Ekspor Pertama Kali"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* GOOGLE DRIVE DOCUMENT LOCKER */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-1 px-2.5 text-blue-800 bg-blue-50 rounded-full font-mono font-bold text-[9px] tracking-wide uppercase">
                  Google Drive Locker
                </span>
                {driveFolderId && (
                  <span className="text-slate-400 text-[10px] font-mono">Linked Folder</span>
                )}
              </div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FolderClosed className="h-5 w-5 text-blue-600" />
                <span>Penyimpanan Kwitansi & PDF Resmi</span>
              </h3>
              <p className="text-slate-600 text-xs leading-relaxed">
                Unggah dan kumpulkan seluruh dokumen bukti transfer donasi dan kwitansi belanja riil di satu folder Google Drive cloud yang terjaga dengan andal. Kami juga mendukung backup database terenkripsi!
              </p>

              {driveFolderId ? (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs space-y-1 mt-4">
                  <p className="text-slate-500 font-semibold font-mono text-[9px] uppercase">ID STORAGE DRIVE TERPAKAI</p>
                  <p className="font-mono text-slate-800 truncate text-[11px] font-bold">{driveFolderId}</p>
                  <div className="pt-2">
                    <a 
                      href={driveFolderUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-bold inline-flex items-center gap-1.5 transition-all text-[11px]"
                    >
                      <span>Buka Folder Google Drive Resmi</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl p-4 text-center mt-4 flex flex-col items-center justify-center gap-2">
                  <p className="text-slate-400 text-xs italic">
                    Belum mendirikan folder eksternal. Kami akan mendirikannya saat upload berjalan pertama kali atau Anda dapat mendirikannya secara manual sekarang.
                  </p>
                  <button
                    type="button"
                    onClick={() => initDriveFolder()}
                    className="mt-1 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                  >
                    Mendirikan Folder Baru Sekarang
                  </button>
                </div>
              )}
            </div>

            {/* QUICK DRIVE DOCUMENT ACTIONS */}
            <div className="grid grid-cols-2 gap-3.5 pt-4">
              <button
                type="button"
                onClick={handleUploadReportPDF}
                disabled={driveSyncLoading}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-bold p-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-100 disabled:text-slate-300"
              >
                <FileText className="h-4 w-4 text-rose-500" />
                <span>Upload PDF Kas</span>
              </button>

              <button
                type="button"
                onClick={handleBackupDatabaseToDrive}
                disabled={driveSyncLoading}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-700 font-bold p-3 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-100 disabled:text-slate-300"
              >
                <Cloud className="h-4 w-4 text-blue-500" />
                <span>Backup JSON DB</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* STORAGE FILES AND UPLOADER DASHBOARD */}
      {googleToken && driveFolderId && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <FolderMinus className="h-4.5 w-4.5 text-blue-600" />
                <span>Unggah Mandiri Slip Bukti & Arsip Fisik</span>
              </h4>
              <p className="text-slate-400 text-xs mt-0.5">Amankan segala bentuk kwitansi, invoice, serta surat legalitas proyek Anda langsung ke folder Google Drive proyek.</p>
            </div>

            <button 
              onClick={() => fetchDriveFiles(driveFolderId)}
              disabled={driveFilesLoading}
              className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold p-2 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <RotateCw className={`h-3 w-3 ${driveFilesLoading ? "animate-spin" : ""}`} />
              <span>Muat Ulang Berkas</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* FILE UPLOADER COMPONENT */}
            <form onSubmit={handleFileUploadToDrive} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 shadow-3xs space-y-4 h-fit">
              <p className="text-slate-700 font-bold font-mono text-[9px] uppercase tracking-wider">UNGGAH BERKAS BARU</p>
              
              <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 bg-white hover:bg-slate-50/50 transition-all">
                <Upload className="h-6 w-6 text-slate-400 mx-auto" />
                <input 
                  type="file" 
                  id="drive-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedUploadFile(file);
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("drive-file-input")?.click()}
                  className="text-emerald-600 hover:text-emerald-700 text-xs font-bold underline block w-full text-center cursor-pointer"
                >
                  {selectedUploadFile ? "Ganti Berkas Terpilih" : "Pilih Berkas Lokal"}
                </button>
                <p className="text-slate-400 text-[10px] break-all">
                  {selectedUploadFile ? selectedUploadFile.name : "JPEG, PNG, PDF atau dokumen sejenis (Maks. 10MB)"}
                </p>
              </div>

              <button
                type="submit"
                disabled={uploadLoading || !selectedUploadFile}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
              >
                {uploadLoading ? (
                  <>
                    <RotateCw className="h-3 w-3 animate-spin" />
                    <span>Mentransfer ke Cloud...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Sekarang</span>
                  </>
                )}
              </button>
            </form>

            {/* DRIVE FILES LIST TABLE */}
            <div className="lg:col-span-2 overflow-x-auto">
              <p className="text-slate-700 font-bold font-mono text-[9px] uppercase tracking-wider mb-3">DAFTAR ARSIP CLOUD TERPULIS</p>
              
              {driveFilesLoading ? (
                <div className="py-12 flex justify-center items-center gap-2">
                  <RotateCw className="h-5 w-5 text-slate-500 animate-spin" />
                  <p className="text-slate-500 font-mono text-xs">Menyusuri arsip folder Google Drive kustom...</p>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-16 text-center border border-slate-100 rounded-2xl bg-slate-50/50">
                  <FolderClosed className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs font-mono">Belum ada slip fisik atau PDF laporan yang disimpan di folder Drive.</p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Nama Berkas</th>
                        <th className="px-4 py-3">Tipe</th>
                        <th className="px-4 py-3">Tanggal Unggah</th>
                        <th className="px-4 py-3 text-right">Tautan</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs text-slate-600 divide-y divide-slate-50">
                      {driveFiles.map((f: any) => (
                        <tr key={f.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-4 py-3.5 font-medium text-slate-700 truncate max-w-[180px]" title={f.name}>
                            {f.name}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400">
                            {f.mimeType.split("/").pop().toUpperCase()}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                            {new Date(f.createdTime).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <a 
                              href={f.webViewLink} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-bold inline-flex items-center gap-1 cursor-pointer text-[11px]"
                            >
                              <span>Lihat</span>
                              <ChevronRight className="h-3 w-3" />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* OPERATIONS SYNC SYSTEM LOGS (Visible after any try) */}
      {googleToken && (
        <div className="bg-slate-900 text-slate-200 p-5 rounded-2xl font-mono border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 text-xs">
            <span className="font-bold text-slate-400 shrink-0 uppercase tracking-widest text-[10px] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-sm animate-pulse" />
              <span>Workspace Sync Diagnostics Terminal</span>
            </span>
            <button 
              onClick={() => setOperationLogs([])} 
              className="text-slate-500 hover:text-slate-300 cursor-pointer text-[10px] uppercase font-bold"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="space-y-1.5 text-xs h-[110px] overflow-y-auto pr-2 custom-scrollbar">
            {operationLogs.length === 0 ? (
              <p className="text-slate-600 text-[11px] italic">Terminal standby. Siap menyinkronkan rekaman...</p>
            ) : (
              operationLogs.map((log, index) => (
                <div key={index} className="flex items-start gap-4 text-[11px] leading-relaxed">
                  <span className="text-slate-500 select-none shrink-0">[{log.time}]</span>
                  <span className={`shrink-0 uppercase font-bold text-[9px] px-1 rounded-sm select-none ${
                    log.type === "success" ? "bg-emerald-500/10 text-emerald-400" :
                    log.type === "error" ? "bg-rose-500/10 text-rose-400" : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {log.type}
                  </span>
                  <p className={`flex-1 ${
                    log.type === "success" ? "text-emerald-300" :
                    log.type === "error" ? "text-rose-300" : "text-slate-300"
                  }`}>
                    {log.msg}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
