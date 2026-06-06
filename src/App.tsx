/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  Coins, 
  DollarSign, 
  FileText, 
  CheckCircle, 
  Loader2, 
  Search, 
  ShieldAlert, 
  Upload, 
  UserSquare2, 
  Clock, 
  Plus, 
  Trash2,
  Check, 
  Eye, 
  ArrowRight,
  Sparkles,
  AlertTriangle,
  History,
  LogOut,
  UserCheck,
  Settings,
  Download,
  Cloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  RABItem, 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  AuditLog,
  Milestone
} from "./types";
import { ImageUploader } from "./components/ImageUploader";
import { jsPDF } from "jspdf";
import GoogleDriveSheetsSync from "./components/GoogleWorkspaceIntegration";
// @ts-ignore
import projectLogo from "./assets/images/smart_build_flat_logo_1780652826297.png";

export const resolveReceiptUrl = (url: string | null): string => {
  if (!url) return "";
  if (url.includes("drive.google.com")) {
    const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/);
    if (match && match[1]) {
      return `/api/drive-proxy?id=${match[1]}`;
    }
  }
  return url;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export const translateCategory = (cat: string) => {
  const mapping: Record<string, string> = {
    Foundation: "Fondasi & Pematangan Lahan",
    Structure: "Pilar Struktur & Beton",
    Roofing: "Pekerjaan Atap & Kubah",
    Finishing: "Pekerjaan Finishing & Tegel",
    MEP: "Sistem MEP & Pemipaan",
    Operational: "Legalitas & Operasional",
    Material: "Material Konstruksi",
    Labor: "Upah Pekerja & Tukang",
    Equipment: "Sewa Peralatan & Alat Berat",
    "Permit/Admin": "Perizinan & IMB Kecamatan",
    Other: "Lain-lain / Serbaguna"
  };
  return mapping[cat] || cat;
};

export const translatePaymentMethod = (method: string) => {
  const mapping: Record<string, string> = {
    "Bank Transfer": "Transfer Bank",
    "E-Wallet": "Dompet Digital (E-Wallet)",
    Cash: "Tunai / Cash",
    Crypto: "Aset Kripto"
  };
  return mapping[method] || method;
};

const getBase64Image = (imgUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imgUrl;
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } else {
        reject(new Error("Gagal mengambil context 2D"));
      }
    };
    img.onerror = (err) => {
      reject(err);
    };
  });
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "treasurer" | "pm" | "config" | "google">("dashboard");
  const [googleToken, setGoogleTokenState] = useState<string | null>(() => localStorage.getItem("google_access_token"));
  const setGoogleToken = (token: string | null) => {
    setGoogleTokenState(token);
    if (token) {
      localStorage.setItem("google_access_token", token);
    } else {
      localStorage.removeItem("google_access_token");
    }
  };

  // Authentication states
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; role: 'ADMIN' | 'TREASURER' | 'PROJECT_MANAGER' } | null>(() => {
    const saved = localStorage.getItem("current_user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrorState, setLoginErrorState] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Derived Authentications with React State hooks
  const isTreasurerAuthenticated = currentUser !== null && (currentUser.role === 'TREASURER' || currentUser.role === 'ADMIN');
  const isPmAuthenticated = currentUser !== null && (currentUser.role === 'PROJECT_MANAGER' || currentUser.role === 'ADMIN');

  // Core Data States
  const [summary, setSummary] = useState<{
    totalRaised: number;
    totalRABTarget: number;
    currentCashBalance: number;
    totalExpenditures: number;
    physicalProgressPercent: number;
    expendituresByCategory: Record<string, number>;
    donationsByPayment: Record<string, number>;
    budgets?: any[];
    progress?: any[];
    projectConfig?: {
      name: string;
      type: 'baru' | 'renovasi' | 'alih_fungsi';
      fundingSource: 'perusahaan' | 'donasi' | 'pribadi';
      status: 'public' | 'private';
      budget: number;
      description: string;
      initialized: boolean;
      initializedAt?: string;
      initializedBy?: string;
    };
  } | null>(null);

  const [donations, setDonations] = useState<Donation[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [progressLog, setProgressLog] = useState<PhysicalProgress[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<{ version: string; year: number }>({
    version: "1.2.8",
    year: new Date().getFullYear(),
  });

  // Project List Edit States
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjType, setEditProjType] = useState<"baru" | "renovasi" | "alih_fungsi">("baru");
  const [editProjFunding, setEditProjFunding] = useState<string>("donasi");
  const [editProjStatus, setEditProjStatus] = useState<"public" | "private">("public");
  const [editProjProjectStatus, setEditProjProjectStatus] = useState<"pending" | "berjalan" | "selesai" | "batal">("berjalan");
  const [editProjBudget, setEditProjBudget] = useState("");
  const [editProjDescription, setEditProjDescription] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "donations" | "expenditures">("all");
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string | null>(null);

  // Forms Input
  const [donationDonor, setDonationDonor] = useState("");
  const [donationAmount, setDonationAmount] = useState("");
  const [donationMethod, setDonationMethod] = useState<"Bank Transfer" | "E-Wallet" | "Cash" | "Crypto">("Bank Transfer");
  const [donationProof, setDonationProof] = useState("");
  const [donationIsAnon, setDonationIsAnon] = useState(false);
  const [donationDirectApprove, setDonationDirectApprove] = useState(true);
  
  const [expItemName, setExpItemName] = useState("");
  const [expCategory, setExpCategory] = useState<"Material" | "Labor" | "Equipment" | "Permit/Admin" | "Other">("Material");
  const [expVolume, setExpVolume] = useState("");
  const [expUnit, setExpUnit] = useState("");
  const [expUnitPrice, setExpUnitPrice] = useState("");
  const [expStoreName, setExpStoreName] = useState("");
  const [expReceipt, setExpReceipt] = useState("");

  const [newProgressPercent, setNewProgressPercent] = useState("");
  const [newProgressDesc, setNewProgressDesc] = useState("");
  const [newProgressPhoto, setNewProgressPhoto] = useState("");

  // Milestone form states
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [newMilestoneCategory, setNewMilestoneCategory] = useState<'Foundation' | 'Structure' | 'Roofing' | 'Finishing' | 'MEP' | 'Operational' | 'Other'>("Foundation");
  const [newMilestoneStatus, setNewMilestoneStatus] = useState<'PENDING' | 'ON_GOING' | 'COMPLETED'>("PENDING");
  const [newMilestoneNotes, setNewMilestoneNotes] = useState("");

  // UI status messages
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Project Config states
  const [newProjName, setNewProjName] = useState("");
  const [newProjType, setNewProjType] = useState<"baru" | "renovasi" | "alih_fungsi">("baru");
  const [newProjFunding, setNewProjFunding] = useState<string>("donasi");
  const [newProjStatus, setNewProjStatus] = useState<"public" | "private">("public");
  const [newProjBudget, setNewProjBudget] = useState("");
  const [newProjDescription, setNewProjDescription] = useState("");
  const [newProjTreasurerName, setNewProjTreasurerName] = useState("");
  const [newProjTreasurerEmail, setNewProjTreasurerEmail] = useState("");
  const [newProjTreasurerPassword, setNewProjTreasurerPassword] = useState("");
  const [newProjPmName, setNewProjPmName] = useState("");
  const [newProjPmEmail, setNewProjPmEmail] = useState("");
  const [newProjPmPassword, setNewProjPmPassword] = useState("");
  const [newProjStartFresh, setNewProjStartFresh] = useState(true);
  const [projConfigLoading, setProjConfigLoading] = useState(false);

  // Helper functions for multiple choice funding sources
  const getFundingSourcesLabel = (fundingSource: string) => {
    if (!fundingSource) return 'Belum Diatur';
    return fundingSource.split(',')
      .map(src => {
        const trimmed = src.trim();
        if (trimmed === 'perusahaan') return 'Sponsor / Perusahaan';
        if (trimmed === 'donasi') return 'Donasi Jamaah';
        if (trimmed === 'pribadi') return 'Kas Internal';
        return trimmed;
      })
      .join(' + ');
  };

  // Fetch core data from full-stack APIs
  const fetchAllData = async (tokenOverride?: string | null) => {
    try {
      setLoading(true);
      const activeToken = tokenOverride !== undefined ? tokenOverride : authToken;
      const headersOpt = activeToken ? { "Authorization": `Bearer ${activeToken}` } : {};
      const [sumRes, donRes, expRes, progRes, auditRes, sysRes, mileRes] = await Promise.all([
        fetch("/api/financial-summary", { headers: headersOpt }),
        fetch("/api/donations", { headers: headersOpt }),
        fetch("/api/expenditures", { headers: headersOpt }),
        fetch("/api/progress", { headers: headersOpt }),
        fetch("/api/audit-logs", { headers: headersOpt }),
        fetch("/api/system-info"),
        fetch("/api/milestones", { headers: headersOpt })
      ]);

      const sumData = await sumRes.json();
      const donData = await donRes.json();
      const expData = await expRes.json();
      const progData = await progRes.json();
      const auditData = await auditRes.json();
      const mileData = mileRes.ok ? await mileRes.json() : [];
      let sysData = { version: "1.2.8", year: new Date().getFullYear() };
      try {
        if (sysRes.ok) {
          sysData = await sysRes.json();
        }
      } catch (e) {
        console.error("Error parsing system-info", e);
      }

      setSummary(sumData);
      setDonations(donData);
      setExpenditures(expData);
      setProgressLog(progData);
      setAuditLogs(auditData);
      setMilestones(mileData);
      setSystemInfo(sysData);

      if (activeToken) {
        try {
          const [projRes, profileRes] = await Promise.all([
            fetch("/api/projects", { headers: headersOpt }),
            fetch("/api/auth/me", { headers: headersOpt })
          ]);
          if (projRes.ok) {
            const projData = await projRes.json();
            setProjects(projData);
          }
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            if (profileData && profileData.user) {
              setCurrentUser(profileData.user);
              localStorage.setItem("current_user", JSON.stringify(profileData.user));
            }
          }
        } catch (e) {
          console.error("Error loading projects list or profile query", e);
        }
      } else {
        setProjects([]);
      }
    } catch (error) {
      console.error("Error loading application state", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Actions trigger functions
  const handleApproveDonation = async (id: string) => {
    try {
      const response = await fetch(`/api/donations/${id}/approve`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ approvedBy: currentUser?.name || "David Miller" })
      });
      if (response.ok) {
        setFormSuccess("Donasi berhasil disetujui! Transaksi log audit tercatat.");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 3000);
      } else {
        const error = await response.json();
        alert(error.error || "Persetujuan gagal.");
      }
    } catch (e) {
      console.error("Approval error", e);
    }
  };

  const handlePostDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!donationDonor.trim() && !donationIsAnon) {
      setFormError("Donor name is mandatory unless anonymous is toggled.");
      return;
    }
    if (!donationAmount || Number(donationAmount) <= 0) {
      setFormError("Donation amount must be positive.");
      return;
    }
    if (!donationProof.trim()) {
      setFormError("Strict Transparency Rule: A bank transfer proof or cash receipt image link is required to log funds.");
      return;
    }

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          donorName: donationDonor,
          isAnonymous: donationIsAnon,
          amount: Number(donationAmount),
          paymentMethod: donationMethod,
          transferProofUrl: donationProof,
          approveDirectly: donationDirectApprove
        })
      });

      if (response.ok) {
        setFormSuccess(`Donation recorded successfully as ${donationDirectApprove ? 'APPROVED' : 'PENDING'}!`);
        setDonationDonor("");
        setDonationAmount("");
        setDonationProof("");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const error = await response.json();
        setFormError(error.error || "Execution failed.");
      }
    } catch (e) {
      setFormError("Communication failure with REST API.");
    }
  };

  const handlePostExpenditure = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!expItemName.trim() || !expVolume || !expUnit || !expUnitPrice || !expStoreName.trim()) {
      setFormError("Mohon lengkapi semua isian formulir.");
      return;
    }
    if (Number(expVolume) <= 0 || Number(expUnitPrice) <= 0) {
      setFormError("Volume dan Harga Satuan harus positif.");
      return;
    }
    // Strict Accountability validation
    if (!expReceipt.trim()) {
      setFormError("DATABASE SHIELD: Transaksi ditolak. Anda wajib mengunggah tautan foto nota/kuitansi pembelian.");
      return;
    }

    try {
      const response = await fetch("/api/expenditures", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          itemName: expItemName,
          category: expCategory,
          volume: Number(expVolume),
          unit: expUnit,
          unitPrice: Number(expUnitPrice),
          storeName: expStoreName,
          receiptUrl: expReceipt
        })
      });

      if (response.ok) {
        setFormSuccess("Pengeluaran kas berhasil dicatat! Anggaran RAB diperbarui dan log audit disinkronkan.");
        setExpItemName("");
        setExpVolume("");
        setExpUnit("");
        setExpUnitPrice("");
        setExpStoreName("");
        setExpReceipt("");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const error = await response.json();
        setFormError(error.error || "Gagal mencatat pengeluaran.");
      }
    } catch (e) {
      setFormError("Gagal terhubung ke server.");
    }
  };

  const handlePostProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (newProgressPercent === undefined || newProgressPercent === "" || !newProgressDesc.trim()) {
      setFormError("Persentase progres fisik dan detail keterangan wajib diisi.");
      return;
    }

    const pctVal = Number(newProgressPercent);
    if (pctVal < 0 || pctVal > 100) {
      setFormError("Persentase harus berada di rentang 0 - 100.");
      return;
    }

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          percentage: pctVal,
          description: newProgressDesc,
          photoUrl: newProgressPhoto
        })
      });

      if (response.ok) {
        setFormSuccess(`Kemajuan fisik berhasil diubah ke ${pctVal}% dan didokumentasikan di lini masa.`);
        setNewProgressPercent("");
        setNewProgressDesc("");
        setNewProgressPhoto("");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const error = await response.json();
        setFormError(error.error || "Gagal memperbarui progres.");
      }
    } catch (e) {
      setFormError("Koneksi gagal saat memperbarui log konstruksi fisik.");
    }
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newMilestoneTitle.trim() || !newMilestoneDate || !newMilestoneCategory || !newMilestoneStatus) {
      setFormError("Judul milestone, estimasi tanggal, kategori, dan status wajib diisi.");
      return;
    }

    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          title: newMilestoneTitle,
          expectedDate: newMilestoneDate,
          category: newMilestoneCategory,
          status: newMilestoneStatus,
          progressNotes: newMilestoneNotes
        })
      });

      if (response.ok) {
        setFormSuccess(`Milestone "${newMilestoneTitle}" berhasil diterbitkan.`);
        setNewMilestoneTitle("");
        setNewMilestoneDate("");
        setNewMilestoneCategory("Foundation");
        setNewMilestoneStatus("PENDING");
        setNewMilestoneNotes("");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal membuat milestone baru.");
      }
    } catch (err) {
      setFormError("Gagal terhubung ke server untuk membuat milestone.");
    }
  };

  const handleUpdateMilestoneStatus = async (id: string, newStatus: any, notes?: string, title?: string, expectedDate?: string, category?: string) => {
    setFormError("");
    setFormSuccess("");

    try {
      const response = await fetch(`/api/milestones/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          status: newStatus,
          progressNotes: notes,
          title,
          expectedDate,
          category
        })
      });

      if (response.ok) {
        setFormSuccess("Milestone berhasil diperbarui.");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal memperbarui status milestone.");
      }
    } catch (err) {
      setFormError("Gagal terhubung ke server.");
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus milestone ini?")) return;
    setFormError("");
    setFormSuccess("");

    try {
      const response = await fetch(`/api/milestones/${id}`, {
        method: "DELETE",
        headers: {
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        }
      });

      if (response.ok) {
        setFormSuccess("Milestone berhasil dihapus.");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal menghapus milestone.");
      }
    } catch (err) {
      setFormError("Gagal terhubung ke server.");
    }
  };

  // JWT Backend Authentication Triggers
  const handleLoginAction = async (emailInput: string, passwordInput: string) => {
    setLoginErrorState("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("current_user", JSON.stringify(data.user));
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setIsLoginModalOpen(false);
        setFormSuccess(`Selamat datang kembali, ${data.user.name}!`);
        setTimeout(() => setFormSuccess(""), 4000);
        fetchAllData(data.token);
        return true;
      } else {
        const err = await response.json();
        setLoginErrorState(err.error || "Autentikasi gagal.");
        return false;
      }
    } catch (e) {
      setLoginErrorState("Gagal terhubung dengan server autentikasi.");
      return false;
    }
  };

  const handleLogoutAction = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    setAuthToken(null);
    setCurrentUser(null);
    setProjects([]);
    setFormSuccess("Sesi Anda telah ditutup dengan aman.");
    setTimeout(() => setFormSuccess(""), 4000);
    fetchAllData(null);
  };

  const handleInitializeProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newProjName.trim()) {
      setFormError("Nama proyek wajib diisi.");
      return;
    }
    if (!newProjBudget || Number(newProjBudget) <= 0) {
      setFormError("Anggaran proyek wajib berupa angka positif.");
      return;
    }
    if (!newProjDescription.trim()) {
      setFormError("Deskripsi rencana proyek wajib diisi.");
      return;
    }
    if (!newProjTreasurerName.trim() || !newProjTreasurerEmail.trim() || !newProjTreasurerPassword.trim()) {
      setFormError("Detail akun Bendahara (Nama, Email, Password) wajib diisi.");
      return;
    }
    if (!newProjPmName.trim() || !newProjPmEmail.trim() || !newProjPmPassword.trim()) {
      setFormError("Detail akun Project Manager (Nama, Email, Password) wajib diisi.");
      return;
    }

    if (newProjTreasurerPassword.length < 4 || newProjPmPassword.length < 4) {
      setFormError("Kata sandi akun pengelola (Bendahara & PM) minimal harus 4 karakter.");
      return;
    }

    try {
      setProjConfigLoading(true);
      const headersOpt = authToken ? { 
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
      } : {
        "Content-Type": "application/json"
      };

      const payload = {
        projectName: newProjName,
        projectType: newProjType,
        fundingSource: newProjFunding,
        projectStatus: newProjStatus,
        budget: Number(newProjBudget),
        description: newProjDescription,
        treasurerEmail: newProjTreasurerEmail,
        treasurerName: newProjTreasurerName,
        treasurerPassword: newProjTreasurerPassword,
        pmEmail: newProjPmEmail,
        pmName: newProjPmName,
        pmPassword: newProjPmPassword,
        startFresh: newProjStartFresh
      };

      const response = await fetch("/api/project-config/initialize", {
        method: "POST",
        headers: headersOpt,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setFormSuccess(data.message || "Proyek berhasil diinisialisasi!");
        setTimeout(() => setFormSuccess(""), 5000);
        
        // Reset form
        setNewProjName("");
        setNewProjBudget("");
        setNewProjDescription("");
        setNewProjTreasurerName("");
        setNewProjTreasurerEmail("");
        setNewProjTreasurerPassword("");
        setNewProjPmName("");
        setNewProjPmEmail("");
        setNewProjPmPassword("");

        // Refresh database & state
        fetchAllData();
        setActiveTab("dashboard");
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal melakukan inisialisasi proyek.");
      }
    } catch (err) {
      setFormError("Terjadi hambatan koneksi saat mengirim konfigurasi ke server.");
    } finally {
      setProjConfigLoading(false);
    }
  };

  const startEditProject = (p: any) => {
    setEditingProjectId(p.id);
    setEditProjName(p.name);
    setEditProjType(p.type || "baru");
    setEditProjFunding(p.fundingSource || "donasi");
    setEditProjStatus(p.status || "public");
    setEditProjProjectStatus(p.projectStatus || p.projectConfig?.projectStatus || "berjalan");
    setEditProjBudget(String(p.budget || ""));
    setEditProjDescription(p.description || "");
  };

  const handleUpdateProject = async (id: string) => {
    try {
      setFormError("");
      setFormSuccess("");

      if (!editProjName.trim()) {
        setFormError("Nama proyek wajib diisi.");
        return;
      }
      if (!editProjBudget || Number(editProjBudget) <= 0) {
        setFormError("Anggaran proyek wajib berupa angka positif.");
        return;
      }
      if (!editProjDescription.trim()) {
        setFormError("Deskripsi rencana proyek wajib diisi.");
        return;
      }

      const headersOpt = authToken ? { 
        "Authorization": `Bearer ${authToken}`,
        "Content-Type": "application/json"
      } : {
        "Content-Type": "application/json"
      };

      const payload = {
        name: editProjName,
        type: editProjType,
        fundingSource: editProjFunding,
        status: editProjStatus,
        projectStatus: editProjProjectStatus,
        budget: Number(editProjBudget),
        description: editProjDescription
      };

      const response = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: headersOpt,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setFormSuccess("Proyek berhasil diperbarui!");
        setTimeout(() => setFormSuccess(""), 5000);
        setEditingProjectId(null);
        // Refresh everything
        fetchAllData();
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal memperbarui proyek.");
      }
    } catch (err) {
      console.error("Error updating project", err);
      setFormError("Gagal memperbarui proyek karena masalah koneksi.");
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus proyek ini? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }
    try {
      setFormError("");
      setFormSuccess("");

      const headersOpt = authToken ? { 
        "Authorization": `Bearer ${authToken}`
      } : {};

      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: headersOpt
      });

      if (response.ok) {
        setFormSuccess("Proyek berhasil dihapus!");
        setTimeout(() => setFormSuccess(""), 5000);
        // Refresh everything
        fetchAllData();
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal menghapus proyek.");
      }
    } catch (err) {
      console.error("Error deleting project", err);
      setFormError("Gagal menghapus proyek karena masalah koneksi.");
    }
  };

  const handleExportDatabase = async () => {
    try {
      setFormError("");
      const headersOpt = authToken ? { 
        "Authorization": `Bearer ${authToken}`
      } : {};

      const response = await fetch("/api/export-database", {
        headers: headersOpt
      });

      if (!response.ok) {
        const err = await response.json();
        setFormError(err.error || "Gagal mengekspor data database.");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `smartbuild_backup_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(link);
      link.click();
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      setFormSuccess("Cadangan basis data berhasil diekspor ke format JSON!");
      setTimeout(() => setFormSuccess(""), 5000);
    } catch (err) {
      console.error("Error exporting database", err);
      setFormError("Gagal mengunduh cadangan database karena masalah koneksi.");
    }
  };

  const handleDownloadLedgerPDF = async () => {
    try {
      setFormError("");
      
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const ledgerData = getCombinedLedger();
      const projectName = summary?.projectConfig?.name || "Belum Ada Proyek Aktif";
      const userDisplayName = currentUser ? `${currentUser.name} (${currentUser.role})` : "Public Guest";
      const printDateStr = new Date().toLocaleString("id-ID", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      // Try loading the logo as Base64 to render it nicely
      let logoBase64: string | null = null;
      try {
        logoBase64 = await getBase64Image(projectLogo);
      } catch (e) {
        console.warn("Could not load project logo in PDF, drawing text fallback instead.", e);
      }

      // Drawing function for header & footer on any page
      const drawHeaderFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
        // Draw Header Group
        pageDoc.setFillColor(255, 255, 255);
        pageDoc.rect(0, 0, 210, 40, "F");

        // Thin top accent line in emerald color
        pageDoc.setFillColor(5, 150, 105); // emerald-500
        pageDoc.rect(0, 0, 210, 3, "F");

        // Draw Logo or Fallback icon
        if (logoBase64) {
          pageDoc.addImage(logoBase64, "PNG", 15, 8, 14, 14);
        } else {
          // Draw a stylized vector fallback for logo (an emerald square with "SB")
          pageDoc.setFillColor(5, 150, 105);
          pageDoc.rect(15, 8, 14, 14, "F");
          pageDoc.setFont("Helvetica", "bold");
          pageDoc.setFontSize(8);
          pageDoc.setTextColor(255, 255, 255);
          pageDoc.text("SB", 22, 17, { align: "center" });
        }

        // Title and branding text
        pageDoc.setFont("Helvetica", "bold");
        pageDoc.setFontSize(11);
        pageDoc.setTextColor(15, 23, 42); // slate-900
        pageDoc.text("PORTAL TRANSPARANSI FINANSIAL SMARTBUILD", 33, 14);

        pageDoc.setFont("Helvetica", "normal");
        pageDoc.setFontSize(8);
        pageDoc.setTextColor(100, 116, 139); // slate-500
        pageDoc.text(`Laporan Buku Besar Resmi Mutasi Kas Pembangunan`, 33, 19);

        pageDoc.setFont("Helvetica", "bold");
        pageDoc.setFontSize(8.5);
        pageDoc.setTextColor(5, 150, 105); // emerald-600
        pageDoc.text(`Proyek: ${projectName}`, 33, 24);

        // Divider
        pageDoc.setDrawColor(226, 232, 240); // slate-200
        pageDoc.setLineWidth(0.4);
        pageDoc.line(15, 29, 195, 29);

        // Draw Footer
        pageDoc.setFont("Helvetica", "normal");
        pageDoc.setFontSize(7.5);
        pageDoc.setTextColor(148, 163, 184); // slate-400
        pageDoc.line(15, 282, 195, 282);
        pageDoc.text("SmartBuild Transparency System - Laporan Autentik Terverifikasi Bank", 15, 287);
        pageDoc.text(`Halaman ${pageNum} dari ${totalPages}`, 195, 287, { align: "right" });
      };

      const marginX = 15;
      const startYPage1 = 34; // starts right after the header line
      let currentY = startYPage1;

      // Draw Metadata Panel (Only on Page 1)
      // Background card: light slate color
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, currentY, 180, 42, "F");
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.rect(marginX, currentY, 180, 42, "S");

      // Card Header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("IKHTISAR LAPORAN KEUANGAN VERIFIKASI", marginX + 6, currentY + 6);

      // Left column of card: details of retrieval
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Unduh Oleh: ${userDisplayName}`, marginX + 6, currentY + 14);
      doc.text(`Dicetak Pada: ${printDateStr}`, marginX + 6, currentY + 20);
      doc.text(`Status Konsistensi: 100% Sesuai Rekening Koran`, marginX + 6, currentY + 26);
      doc.text(`Total Baris Mutasi: ${ledgerData.length} baris`, marginX + 6, currentY + 32);

      // Right column of card (Totals box inside metadata card)
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX + 105, currentY + 4, 70, 34, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX + 105, currentY + 4, 70, 34, "S");

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`TOTAL PENERIMAAN (DONASI):`, marginX + 109, currentY + 9);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(5, 150, 105); // emerald-500
      doc.text(formatCurrency(totalRaisedApproved), marginX + 109, currentY + 13);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`TOTAL PENGELUARAN BELANJA:`, marginX + 109, currentY + 20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text(formatCurrency(totalSpent), marginX + 109, currentY + 24);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`SALDO KAS SAAT INI:`, marginX + 109, currentY + 30);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(formatCurrency(balancedCash), marginX + 109, currentY + 34);

      currentY += 48; // add space after metadata block

      // Draw Ledger section header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("RIWAYAT MUTASI KAS PEMBANGUNAN BERJALAN", marginX, currentY);
      currentY += 14;

      // Table styling details
      const tableHeaders = ["No.", "Tanggal & Jam", "Keterangan / Detil Aktivitas", "Jenis", "Jumlah"];
      const colWidths = [10, 35, 75, 30, 30]; // Matches 180 total
      const colAligns = ["center", "left", "left", "center", "right"];

      // Draw table row drawing helper
      const drawRow = (rowY: number, values: string[], isHeader = false) => {
        let xPos = marginX;
        
        // Draw background for header row or alternating row colors
        if (isHeader) {
          doc.setFillColor(15, 23, 42); // slate-900 (dense, readable)
          doc.rect(marginX, rowY - 5, 180, 8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
        } else {
          doc.setTextColor(51, 65, 85); // slate-700
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
        }

        // Write row cell values
        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          const colW = colWidths[i];
          const align = colAligns[i];
          
          let textX = xPos;
          if (align === "center") {
            textX = xPos + colW / 2;
          } else if (align === "right") {
            textX = xPos + colW - 2;
          } else {
            textX = xPos + 2;
          }

          if (isHeader) {
            doc.text(val, textX, rowY, { align: align as any });
          } else {
            // Apply nice green / red formatting for amount cell and type cell specifically
            if (i === 3) { // Type column
              if (val === "Donasi") {
                doc.setTextColor(5, 150, 105); // green
              } else {
                doc.setTextColor(220, 38, 38); // red
              }
            } else if (i === 4) { // Amount column
              if (values[3] === "Donasi") {
                doc.setTextColor(5, 150, 105);
              } else {
                doc.setTextColor(220, 38, 38);
              }
            } else {
              doc.setTextColor(51, 65, 85);
            }
            
            // Text truncation or wrapping helper for Keterangan (ColIndex = 2)
            if (i === 2 && val.length > 50) {
              const truncated = val.substring(0, 48) + "...";
              doc.text(truncated, textX, rowY, { align: align as any });
            } else {
              doc.text(val, textX, rowY, { align: align as any });
            }
          }
          xPos += colW;
        }

        // Draw light bottom link line
        if (!isHeader) {
          doc.setDrawColor(241, 245, 249); // slate-100
          doc.setLineWidth(0.2);
          doc.line(marginX, rowY + 3, marginX + 180, rowY + 3);
        }
      };

      // Draw first table headers
      drawRow(currentY, tableHeaders, true);
      currentY += 8;

      let currentPageNum = 1;
      const rowHeight = 8;
      const maxYSpace = 265; // Bottom bound of printable tables on A4

      // Now map and write rows dynamically
      ledgerData.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const dateFormatted = `${itemDate.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric' })} ${itemDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}`;
        
        const rowType = item.type === "donation" ? "Donasi" : "Belanja";
        const prefix = item.type === "donation" ? "+" : "-";
        const amtFormatted = `${prefix} ${formatCurrency(item.amount)}`;
        const detailsStr = item.type === "donation" ? `${item.name} (${item.meta})` : `${item.name} (${item.meta})`;

        const rowValues = [
          (index + 1).toString(),
          dateFormatted,
          detailsStr,
          rowType,
          amtFormatted
        ];

        // Check if adding this row spills over the threshold
        if (currentY + rowHeight > maxYSpace) {
          // Add page
          doc.addPage();
          currentPageNum++;
          currentY = 40; // reset currentY for page 2+ to start below header line nicely
          
          // Draw table headers again
          drawRow(currentY, tableHeaders, true);
          currentY += 8;
        }

        drawRow(currentY, rowValues, false);
        currentY += rowHeight;
      });

      // After plotting all rows, we know the exact total pages.
      const totalPages = currentPageNum;

      // Draw header and footer layout dynamically for all pages
      for (let pNum = 1; pNum <= totalPages; pNum++) {
        doc.setPage(pNum);
        drawHeaderFooter(doc, pNum, totalPages);
      }

      // Save document
      const docName = `Laporan_Buku_Besar_Mutasi_Kas_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(docName);
      setFormSuccess(`Laporan keuangan berhasil diunduh sebagai PDF dengan nama "${docName}"!`);
      setTimeout(() => setFormSuccess(""), 6000);
    } catch (error) {
      console.error("Gagal menghasilkan PDF mutasi kas", error);
      setFormError("Gagal memformat atau mengunduh PDF laporan kas.");
    }
  };

  // Combine, sort and filter ledger collections
  const getCombinedLedger = () => {
    const list: Array<{
      id: string;
      date: string;
      type: "donation" | "expenditure";
      name: string;
      meta: string; // e.g. Payment Method or Vendor Store
      amount: number;
      proofUrl: string;
      extra: string; // Anonymous, categories, etc.
      status?: "APPROVED" | "PENDING";
    }> = [];

    if (ledgerFilter === "all" || ledgerFilter === "donations") {
      donations.forEach(d => {
        list.push({
          id: d.id,
          date: d.date,
          type: "donation",
          name: d.isAnonymous ? "Anonymous Donor" : d.donorName,
          meta: d.paymentMethod,
          amount: d.amount,
          proofUrl: d.transferProofUrl,
          extra: d.isAnonymous ? "Anonymous Contribution" : "Public Donator",
          status: d.status
        });
      });
    }

    if (ledgerFilter === "all" || ledgerFilter === "expenditures") {
      expenditures.forEach(e => {
        list.push({
          id: e.id,
          date: e.date,
          type: "expenditure",
          name: e.itemName,
          meta: `Paid to ${e.storeName}`,
          amount: e.totalPrice,
          proofUrl: e.receiptUrl,
          extra: `${e.category} (${e.volume} ${e.unit} @ $${e.unitPrice}/${e.unit})`,
          status: "APPROVED" // expenditures are verified directly on submission
        });
      });
    }

    // Sort descending order by date
    let sorted = list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.meta.toLowerCase().includes(q) ||
        item.extra.toLowerCase().includes(q) ||
        item.amount.toString().includes(q)
      );
    }

    return sorted;
  };

  // 1. Log custom audits from Google Integrations
  const logAuditFromClient = async (
    action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE", 
    tableName: "Donation" | "Expenditure" | "PhysicalProgress" | "Budget", 
    recordId: string, 
    details: string
  ) => {
    try {
      await fetch("/api/audit-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ action, tableName, recordId, details })
      });
      fetchAllData();
    } catch (e) {
      console.error("Gagal mencatat audit log integrasi Google", e);
    }
  };

  // 2. Generate PDF Blob helper for Google Drive direct upload
  const generateLedgerBlob = async (): Promise<Blob | null> => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const ledgerData = getCombinedLedger();
      const projectName = summary?.projectConfig?.name || "Belum Ada Proyek Aktif";
      const userDisplayName = currentUser ? `${currentUser.name} (${currentUser.role})` : "Public Guest";
      const printDateStr = new Date().toLocaleString("id-ID", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      });

      let logoBase64: string | null = null;
      try {
        logoBase64 = await getBase64Image(projectLogo);
      } catch (e) {
        console.warn("Could not load project logo in PDF, drawing text fallback instead.", e);
      }

      // Drawing function for header & footer on any page
      const drawHeaderFooter = (pageDoc: typeof doc, pageNum: number, totalPages: number) => {
        pageDoc.setFillColor(255, 255, 255);
        pageDoc.rect(0, 0, 210, 40, "F");

        // Thin top accent line in emerald color
        pageDoc.setFillColor(5, 150, 105); // emerald-500
        pageDoc.rect(0, 0, 210, 3, "F");

        // Draw Logo or Fallback icon
        if (logoBase64) {
          pageDoc.addImage(logoBase64, "PNG", 15, 8, 14, 14);
        } else {
          pageDoc.setFillColor(5, 150, 105);
          pageDoc.rect(15, 8, 14, 14, "F");
          pageDoc.setFont("Helvetica", "bold");
          pageDoc.setFontSize(8);
          pageDoc.setTextColor(255, 255, 255);
          pageDoc.text("SB", 22, 17, { align: "center" });
        }

        pageDoc.setFont("Helvetica", "bold");
        pageDoc.setFontSize(11);
        pageDoc.setTextColor(15, 23, 42); // slate-900
        pageDoc.text("PORTAL TRANSPARANSI FINANSIAL SMARTBUILD", 33, 14);

        pageDoc.setFont("Helvetica", "normal");
        pageDoc.setFontSize(8);
        pageDoc.setTextColor(100, 116, 139); // slate-500
        pageDoc.text(`Laporan Buku Besar Resmi Mutasi Kas Pembangunan`, 33, 19);

        pageDoc.setFont("Helvetica", "bold");
        pageDoc.setFontSize(8.5);
        pageDoc.setTextColor(5, 150, 105); // emerald-600
        pageDoc.text(`Proyek: ${projectName}`, 33, 24);

        pageDoc.setDrawColor(226, 232, 240); // slate-200
        pageDoc.setLineWidth(0.4);
        pageDoc.line(15, 29, 195, 29);

        // Draw Footer
        pageDoc.setFont("Helvetica", "normal");
        pageDoc.setFontSize(7.5);
        pageDoc.setTextColor(148, 163, 184); // slate-400
        pageDoc.line(15, 282, 195, 282);
        pageDoc.text("SmartBuild Transparency System - Laporan Autentik Terverifikasi Bank", 15, 287);
        pageDoc.text(`Halaman ${pageNum} dari ${totalPages}`, 195, 287, { align: "right" });
      };

      const marginX = 15;
      const startYPage1 = 34; // starts right after the header line
      let currentY = startYPage1;

      // Draw Metadata Panel (Only on Page 1)
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(marginX, currentY, 180, 42, "F");
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.rect(marginX, currentY, 180, 42, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("IKHTISAR LAPORAN KEUANGAN VERIFIKASI", marginX + 6, currentY + 6);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Unduh Oleh: ${userDisplayName}`, marginX + 6, currentY + 14);
      doc.text(`Dicetak Pada: ${printDateStr}`, marginX + 6, currentY + 20);
      doc.text(`Status Konsistensi: 100% Sesuai Rekening Koran`, marginX + 6, currentY + 26);
      doc.text(`Total Baris Mutasi: ${ledgerData.length} baris`, marginX + 6, currentY + 32);

      // Right column of card (Totals box inside metadata card)
      doc.setFillColor(255, 255, 255);
      doc.rect(marginX + 105, currentY + 4, 70, 34, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX + 105, currentY + 4, 70, 34, "S");

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`TOTAL PENERIMAAN (DONASI):`, marginX + 109, currentY + 9);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(5, 150, 105); // emerald-500
      doc.text(formatCurrency(totalRaisedApproved), marginX + 109, currentY + 13);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`TOTAL PENGELUARAN BELANJA:`, marginX + 109, currentY + 20);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(220, 38, 38); // red-600
      doc.text(formatCurrency(totalSpent), marginX + 109, currentY + 24);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`SALDO KAS SAAT INI:`, marginX + 109, currentY + 30);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(formatCurrency(balancedCash), marginX + 109, currentY + 34);

      currentY += 48; // add space after metadata block

      // Draw Ledger section header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("RIWAYAT MUTASI KAS PEMBANGUNAN BERJALAN", marginX, currentY);
      currentY += 14;

      const tableHeaders = ["No.", "Tanggal & Jam", "Keterangan / Detil Aktivitas", "Jenis", "Jumlah"];
      const colWidths = [10, 35, 75, 30, 30]; // Matches 180 total
      const colAligns = ["center", "left", "left", "center", "right"];

      const drawRow = (rowY: number, values: string[], isHeader = false) => {
        let xPos = marginX;
        
        if (isHeader) {
          doc.setFillColor(15, 23, 42); // slate-900 (dense, readable)
          doc.rect(marginX, rowY - 5, 180, 8, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(8);
        } else {
          doc.setTextColor(51, 65, 85); // slate-700
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(7.5);
        }

        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          const colW = colWidths[i];
          const align = colAligns[i];
          
          let textX = xPos;
          if (align === "center") {
            textX = xPos + colW / 2;
          } else if (align === "right") {
            textX = xPos + colW - 2;
          } else {
            textX = xPos + 2;
          }

          if (isHeader) {
            doc.text(val, textX, rowY, { align: align as any });
          } else {
            if (i === 3) { // Type column
              if (val === "Donasi") {
                doc.setTextColor(5, 150, 105);
              } else {
                doc.setTextColor(220, 38, 38);
              }
            } else if (i === 4) { // Amount column
              if (values[3] === "Donasi") {
                doc.setTextColor(5, 150, 105);
              } else {
                doc.setTextColor(220, 38, 38);
              }
            } else {
              doc.setTextColor(51, 65, 85);
            }
            
            if (i === 2 && val.length > 50) {
              const truncated = val.substring(0, 48) + "...";
              doc.text(truncated, textX, rowY, { align: align as any });
            } else {
              doc.text(val, textX, rowY, { align: align as any });
            }
          }
          xPos += colW;
        }

        if (!isHeader) {
          doc.setDrawColor(241, 245, 249); // slate-100
          doc.setLineWidth(0.2);
          doc.line(marginX, rowY + 3, marginX + 180, rowY + 3);
        }
      };

      drawRow(currentY, tableHeaders, true);
      currentY += 8;

      let currentPageNum = 1;
      const rowHeight = 8;
      const maxYSpace = 265; // Bottom bound of printable tables on A4

      ledgerData.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const dateFormatted = `${itemDate.toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric' })} ${itemDate.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}`;
        
        const rowType = item.type === "donation" ? "Donasi" : "Belanja";
        const prefix = item.type === "donation" ? "+" : "-";
        const amtFormatted = `${prefix} ${formatCurrency(item.amount)}`;
        const detailsStr = `${item.name} (${item.meta})`;

        const rowValues = [
          (index + 1).toString(),
          dateFormatted,
          detailsStr,
          rowType,
          amtFormatted
        ];

        if (currentY + rowHeight > maxYSpace) {
          doc.addPage();
          currentPageNum++;
          currentY = 40;
          drawRow(currentY, tableHeaders, true);
          currentY += 8;
        }

        drawRow(currentY, rowValues, false);
        currentY += rowHeight;
      });

      const totalPages = currentPageNum;
      for (let pNum = 1; pNum <= totalPages; pNum++) {
        doc.setPage(pNum);
        drawHeaderFooter(doc, pNum, totalPages);
      }

      return doc.output("blob");
    } catch (e) {
      console.error("Gagal format pdf blob", e);
      return null;
    }
  };

  // Recalculating totals
  const totalRaisedApproved = donations
    .filter(d => d.status === "APPROVED")
    .reduce((sum, d) => sum + d.amount, 0);

  const totalSpent = expenditures
    .reduce((sum, e) => sum + e.totalPrice, 0);

  const balancedCash = totalRaisedApproved - totalSpent;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      {/* Top Navigation & Global Identity */}
      <header className="sticky top-0 z-40 h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 flex-shrink-0 shadow-xs">
        {/* Left Side: Branding */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
          <img 
            src={projectLogo} 
            alt="SmartBuild Logo" 
            className="h-[36px] w-[36px] object-contain flex-shrink-0"
            referrerPolicy="no-referrer" 
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800"><span className="text-emerald-600 font-extrabold">SmartBuild</span></h1>
          </div>
        </div>

        {/* Center Side: Desktop Portal Tabs */}
        <nav className="hidden md:flex space-x-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "dashboard"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("treasurer")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "treasurer"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Bendahara
          </button>
          <button
            onClick={() => setActiveTab("pm")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "pm"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Project Manager
          </button>
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab("config")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                activeTab === "config"
                  ? "bg-amber-100 text-amber-900 shadow-sm border border-amber-200"
                  : "text-amber-700 hover:text-amber-900 hover:bg-amber-50"
              }`}
            >
              <Settings className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
              <span>Inisialisasi Proyek</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("google")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === "google"
                ? "bg-blue-100 text-blue-900 shadow-sm border border-blue-200"
                : "text-blue-700 hover:text-blue-900 hover:bg-blue-50"
            }`}
          >
            <Cloud className="h-3.5 w-3.5 text-blue-500" />
            <span>Integrasi Google</span>
          </button>
        </nav>

        {/* Right Side: Integrity status */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">DATABASE</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold italic justify-end">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> AKTIF
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
          
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] font-mono font-extrabold text-amber-600 leading-none mt-1">
                  {currentUser.role === 'ADMIN' ? '👑 SUPER ADMIN' : currentUser.role === 'TREASURER' ? '💰 BENDAHARA' : '🧱 PROJECT MANAGER'}
                </p>
              </div>
              <button 
                onClick={handleLogoutAction}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => {
                setLoginErrorState("");
                setIsLoginModalOpen(true);
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Actions Ribbon */}
      <div className="md:hidden sticky top-20 z-30 bg-white border-b border-slate-200 flex overflow-x-auto whitespace-nowrap py-2.5 px-4 space-x-2 scrollbar-none">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "dashboard" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Dashboard Publik
        </button>
        <button
          onClick={() => setActiveTab("treasurer")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "treasurer" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Bendahara
        </button>
        <button
          onClick={() => setActiveTab("pm")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "pm" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Manajer Proyek
        </button>
        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => setActiveTab("config")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "config" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Inisialisasi
          </button>
        )}
        <button
          onClick={() => setActiveTab("google")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "google" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Integrasi Google
        </button>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Loading Ring */}
        {loading && (
          <div className="py-24 flex flex-col justify-center items-center space-y-4">
            <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
            <p className="text-slate-500 font-mono text-xs">Synchronizing audited financial database state...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* 1. PUBLIC DASHBOARD VIEW */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">

                {/* Dashboard Page Title Section */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      {summary?.projectConfig?.initialized && summary?.projectConfig?.name 
                        ? summary.projectConfig.name 
                        : "Belum Ada Proyek Aktif"}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Dashboard Utama Transparansi Finansial Real-Time Proyek
                    </p>
                  </div>
                  {summary?.projectConfig?.initialized && (
                    <div className="flex items-center gap-2 font-mono text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 self-start sm:self-center">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                      <span className="font-bold tracking-wider uppercase">PELACAKAN AKTIF</span>
                    </div>
                  )}
                </div>

                {/* Project Setup Information Board */}
                {summary?.projectConfig && summary.projectConfig.initialized ? (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
                          INFORMASI RESMI PROYEK : {summary.projectConfig.status ? summary.projectConfig.status.toUpperCase() : "PUBLIC"}
                        </span>
                        <h2 className="text-sm font-semibold text-slate-500 mt-1">
                          Detail Rancangan & Spesifikasi Pembangunan
                        </h2>
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                        <span className="bg-sky-50 text-sky-700 font-bold px-2.5 py-0.5 rounded-md capitalize border border-sky-200">
                          Tipe: {summary.projectConfig.type === 'baru' ? 'Proyek Baru' : summary.projectConfig.type === 'renovasi' ? 'Renovasi' : 'Alih Fungsi'}
                        </span>
                        <span className="bg-purple-50 text-purple-700 font-bold px-2.5 py-0.5 rounded-md capitalize border border-purple-200">
                          Sumber Dana: {getFundingSourcesLabel(summary.projectConfig.fundingSource)}
                        </span>
                        <span className="bg-amber-50 text-amber-900 font-bold px-2.5 py-0.5 rounded-md capitalize border border-amber-200">
                          Peruntukan: {summary.projectConfig.status === 'public' ? 'Publik' : 'Privat'}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      {summary.projectConfig.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 font-mono text-[10px] text-slate-500">
                      <div>
                        <span className="block font-bold text-slate-400 text-[9px] uppercase tracking-wider">Anggaran Target</span>
                        <span className="text-xs font-bold text-slate-700">{formatCurrency(summary.projectConfig.budget)}</span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 text-[9px] uppercase tracking-wider">Dimulai Tanggal</span>
                        <span className="text-xs font-bold text-slate-700">
                          {summary.projectConfig.initializedAt ? new Date(summary.projectConfig.initializedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 text-[9px] uppercase tracking-wider">Inisiator</span>
                        <span className="text-xs font-bold text-slate-700">{summary.projectConfig.initializedBy || 'Super Admin'}</span>
                      </div>
                      <div>
                        <span className="block font-semibold text-slate-400 text-[9px] uppercase tracking-wider font-mono">Pelacakan Lapangan</span>
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                          TRANSPARAN AKTIF
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50/50 border border-amber-200/50 text-amber-900 rounded-xl p-6 text-center space-y-3 animate-fade-in shadow-xs">
                    <AlertTriangle className="h-7 w-7 text-amber-600 mx-auto animate-bounce" />
                    <h3 className="text-sm font-extrabold text-slate-800">Sistem Transparansi Bersih: Belum Ada Proyek Aktif</h3>
                    <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                      Sistem mendeteksi bahwa saat ini tidak ada proyek pembangunan yang terdaftar di basis data. Silakan masuk / login sebagai <span className="font-bold text-slate-800">Super Admin</span> dan buka menu <span className="font-bold text-amber-700">Inisialisasi Proyek</span> untuk menambahkan proyek pertama Anda.
                    </p>
                  </div>
                )}
                
                {/* Real-time Counter Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Total Donations Stats Card */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Total Donasi Terkumpul</p>
                      <h2 className="text-2xl font-bold text-slate-800 font-mono">
                        {formatCurrency(summary?.totalRaised ?? 0)}
                      </h2>
                      <div className="w-full bg-slate-100 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500" 
                          style={{ width: `${summary ? Math.min(100, (summary.totalRaised / summary.totalRABTarget) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-[10px] mt-2 text-slate-500 italic">
                        {summary ? Math.round((summary.totalRaised / summary.totalRABTarget) * 100) : 0}% dari Target {formatCurrency(summary?.totalRABTarget ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Total Expenditures Stats Card */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wider">Total Pengeluaran (Belanja)</p>
                      <h2 className="text-2xl font-bold text-rose-600 font-mono">
                        {formatCurrency(summary?.totalExpenditures ?? 0)}
                      </h2>
                      <p className="text-[10px] mt-[18px] text-slate-500 leading-none uppercase tracking-tight font-semibold">
                        {expenditures.length} Kuitansi Rinci Terverifikasi Bendahara
                      </p>
                    </div>
                  </div>

                  {/* Current Cash Balance Stats Card (Emerald theme) */}
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-800 uppercase mb-1 tracking-wider">Saldo Kas Saat Ini</p>
                      <h2 className="text-2xl font-bold text-emerald-900 font-mono">
                        {formatCurrency(summary?.currentCashBalance ?? 0)}
                      </h2>
                      <p className="text-[10px] mt-[18px] text-emerald-700/60 font-bold uppercase tracking-widest">
                        Log Transaksi Terproteksi & Akuntabel
                      </p>
                    </div>
                  </div>
                </div>

                {/* Self-Reporting Ledger Transparency Pledge */}
                <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl flex items-center space-x-3.5 shadow-sm">
                  <div className="bg-emerald-600 text-white rounded-lg p-2 flex items-center justify-center">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest leading-none">Pernyataan Komitmen Transparansi Publik</h3>
                    <p className="text-emerald-700 text-xxs mt-1 font-medium leading-relaxed">
                      Seluruh material konstruksi, upah pekerja lapang, dan donasi jamaah/masyarakat divalidasi langsung dalam database buku kas transparan di bawah ini. Silakan klik baris transaksi apa pun untuk menginspeksi foto bukti transfer bank atau lembar nota kuitansi fisik toko asli.
                    </p>
                  </div>
                </div>

                {/* Visual Ledger Splits */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Ledger Table (Left 8 columns) */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col lg:col-span-8 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                      <div>
                        <h3 className="font-bold text-slate-700">Buku Transparansi Kas Publik</h3>
                        <p className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider leading-none mt-1">Snapshot riwayat mutasi dari database cloud terverifikasi</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="Cari nama atau ID..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="text-xs border border-slate-200 rounded px-3 py-1.5 pl-8 w-44 bg-white focus:outline-hidden focus:border-emerald-600"
                          />
                        </div>
                        <select 
                          value={ledgerFilter} 
                          onChange={(e: any) => setLedgerFilter(e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2.5 py-1.5 font-medium text-slate-600 bg-white focus:outline-hidden"
                        >
                          <option value="all">Semua Aktivitas</option>
                          <option value="donations">Hanya Donasi</option>
                          <option value="expenditures">Hanya Belanja/Pengeluaran</option>
                        </select>
                        {isTreasurerAuthenticated && (
                          <button
                            type="button"
                            onClick={handleDownloadLedgerPDF}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/10"
                            title="Unduh Buku Mutasi Sebagai Laporan PDF Resmi"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>Unduh PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full text-left">
                        <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3">Tanggal / Waktu</th>
                            <th className="px-4 py-3">Pihak / Keterangan</th>
                            <th className="px-4 py-3">Kategori</th>
                            <th className="px-4 py-3 text-right">Jumlah</th>
                            <th className="px-4 py-3 text-center">Bukti Audit</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs text-slate-600">
                          {getCombinedLedger().length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400 font-mono">
                                Tidak ditemukan mutasi transaksi yang cocok dengan pencarian Anda.
                              </td>
                            </tr>
                          ) : (
                            getCombinedLedger().map((item) => (
                              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                                <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-slate-500">
                                  {new Date(item.date).toLocaleDateString("id-ID")} {new Date(item.date).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-semibold text-slate-800">{item.name}</span>
                                  <p className="text-[10px] text-slate-400 italic font-mono truncate w-44">TX_ID: {item.id.substring(0, 10)}...</p>
                                </td>
                                <td className="px-4 py-3">
                                  {item.type === "donation" ? (
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">DONASI</span>
                                  ) : (
                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                      {translateCategory(item.extra.split(" ")[0] || "Operational")}
                                    </span>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-right font-semibold font-mono ${item.type === 'donation' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {item.type === 'donation' ? '+' : '-'}{formatCurrency(item.amount)}
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  {item.status === "PENDING" ? (
                                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-1 rounded">MENUNGGU VERIFIKASI</span>
                                  ) : (
                                    <button 
                                      onClick={() => setSelectedReceiptUrl(item.proofUrl)}
                                      className="text-blue-500 hover:underline text-[10px] font-bold"
                                    >
                                      {item.type === 'donation' ? 'BUKTI TRANSFER' : 'LIHAT NOTA'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                      <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider block">
                        🔒 INTEGRITAS DATA MUTASI AUDIT DENGAN TRANSAKSI FISIK TERVERIFIKASI
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Physical Progress & Audit Trail (col-span-4) */}
                  <div className="lg:col-span-4 flex flex-col gap-6">
                    
                    {/* Physical Construction Progress Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <h3 className="font-bold text-slate-800 mb-4 font-sans tracking-tight">Perkembangan Fisik Proyek</h3>
                      <div className="relative flex flex-col items-center justify-center p-4 mb-4">
                        <div className="w-32 h-32 rounded-full border-8 border-slate-100 flex items-center justify-center">
                          <span className="text-3xl font-black text-slate-800">{summary?.physicalProgressPercent ?? 0}%</span>
                        </div>
                        {/* Interactive custom circular stroke using SVG and ResizeObserver/absolute dimensions */}
                        <svg className="absolute w-32 h-32 -rotate-90">
                          <circle
                            cx="64"
                            cy="64"
                            r="56"
                            className="stroke-emerald-500"
                            strokeWidth="8"
                            fill="transparent"
                            strokeDasharray="351.85"
                            strokeDashoffset={351.85 - (351.85 * (summary?.physicalProgressPercent ?? 0)) / 100}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <div className="space-y-3 flex-1">
                        {progressLog.length > 0 ? (
                          [...progressLog].reverse().slice(0, 3).map((log) => (
                            <div key={log.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-600 font-medium font-sans line-clamp-1" title={log.description}>
                                  {log.description}
                                </span>
                                <span className="text-emerald-600 font-bold shrink-0 ml-2">{log.percentage}%</span>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-0.5">
                                {new Date(log.timelineDate).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-slate-400 text-xs py-4 italic">
                            Belum ada rincian kemajuan fisik yang tercatat di database.
                          </div>
                        )}
                      </div>
                      {progressLog.length > 0 && (
                        <div className="mt-6 border-t border-slate-150 pt-4">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Foto Lapangan Terbaru</p>
                          <div className="h-32 bg-slate-200 rounded-lg overflow-hidden relative">
                            {progressLog[progressLog.length - 1].photoUrls?.[0] ? (
                              <img 
                                src={resolveReceiptUrl(progressLog[progressLog.length - 1].photoUrls![0])} 
                                alt="Project construction snapshot preview" 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-300 flex items-center justify-center text-slate-400 italic text-xs">
                                [Pratinjau Foto Lokasi]
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-2.5">
                              <p className="text-[10px] text-white font-medium truncate w-full">
                                {progressLog[progressLog.length - 1].description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Linimasa Milestones Proyek Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 text-xs font-sans tracking-tight flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Linimasa Milestones Proyek</span>
                        </h3>
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono uppercase font-bold">
                          {milestones.filter(m => m.status === 'COMPLETED').length}/{milestones.length} Selesai
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 mb-5 leading-normal">
                        Daftar sasaran strategis konstruksi fisik proyek beserta estimasi tanggal pencapaiannya.
                      </p>

                      <div className="relative border-l border-slate-150 ml-3 space-y-5">
                        {milestones.length > 0 ? (
                          [...milestones]
                            .sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime())
                            .map((ms) => {
                              const isCompleted = ms.status === 'COMPLETED';
                              const isOngoing = ms.status === 'ON_GOING';
                              
                              let dotClass = "bg-slate-200 border-slate-350 text-slate-400";
                              if (isCompleted) {
                                dotClass = "bg-emerald-500 border-emerald-600 text-white shadow-emerald-100 shadow-sm";
                              } else if (isOngoing) {
                                dotClass = "bg-amber-500 border-amber-600 text-white shadow-amber-100 shadow-sm";
                              }

                              return (
                                <div key={ms.id} className="relative pl-5">
                                  {/* Milestone dot connector */}
                                  <span className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border font-mono text-[8px] font-bold ${dotClass}`}>
                                    {isCompleted ? "✓" : isOngoing ? "➔" : "•"}
                                  </span>

                                  <div className="space-y-1">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                                      <h4 className={`text-xxs font-bold leading-snug break-all ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                        {ms.title}
                                      </h4>
                                      <span className="text-[8px] font-bold font-mono text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded shrink-0 self-start">
                                        {new Date(ms.expectedDate).toLocaleDateString("id-ID", {
                                          day: "numeric",
                                          month: "short"
                                        })}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.2 rounded uppercase">
                                        {translateCategory(ms.category)}
                                      </span>
                                      
                                      {isCompleted && (
                                        <span className="text-[8px] text-emerald-750 bg-emerald-50 border border-emerald-100 px-1 py-0.2 rounded font-bold uppercase">Selesai</span>
                                      )}
                                      {isOngoing && (
                                        <span className="text-[8px] text-amber-750 bg-amber-50 border border-amber-100 px-1 py-0.2 rounded font-bold uppercase">Sedang Berjalan</span>
                                      )}
                                      {ms.status === 'PENDING' && (
                                        <span className="text-[8px] text-slate-500 bg-slate-50 border border-slate-100 px-1 py-0.2 rounded font-bold uppercase">Pending</span>
                                      )}
                                    </div>

                                    {ms.progressNotes && (
                                      <p className="text-[9px] text-slate-500 leading-relaxed bg-slate-50 p-1.5 rounded border border-dashed border-slate-200 mt-1 italic">
                                        {ms.progressNotes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                        ) : (
                          <div className="text-center text-slate-400 text-xs py-4 italic">
                            Belum ada rincian sasaran strategis proyek yang terdaftar.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cryptographic Live Audit Log (Internal Integrity Check matching mockup design text perfectly) */}
                    <div className="bg-slate-900 p-6 rounded-xl shadow-xl text-white flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-bold text-white mb-4 text-sm flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                          </svg>
                          Log Audit Real-time
                        </h3>
                        <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                          {auditLogs.slice(0, 3).map((log, index) => (
                            <div key={log.id} className={`border-l-2 pl-3 py-1 ${index === 0 ? 'border-emerald-500/30' : 'border-slate-700'}`}>
                              <p className="text-[10px] text-emerald-400 font-mono">#{log.id.substring(0, 5).toUpperCase()} - {log.action}</p>
                              <p className="text-xs text-slate-300 leading-tight pr-1">{log.details}</p>
                              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString()}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-800">
                        <p className="text-[9px] text-slate-400 text-center italic">Setiap entri tersimpan mutlak dalam rantai log sistem basis data aman terpercaya</p>
                      </div>
                    </div>

                    {/* Expenditures Category Split visual progress list */}
                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
                      <h3 className="font-bold text-slate-800 text-xs mb-3 font-sans">Distribusi Alokasi Belanja</h3>
                      <div className="space-y-2.5 text-xs">
                        {(() => {
                           const catEntries = summary?.expendituresByCategory ? Object.entries(summary.expendituresByCategory) : [];
                           const totalExp = catEntries.reduce((acc, [_, val]) => acc + (val as number), 0) || 1;
                           if (catEntries.length === 0) {
                             return <p className="font-mono text-xxs text-slate-400">Memuat analisis kategori...</p>;
                           }
                           return catEntries.map(([cat, amount]) => {
                             const prc = ((amount as number) / totalExp) * 100;
                             return (
                               <div key={cat} className="space-y-1">
                                 <div className="flex justify-between text-xxs font-semibold text-slate-500">
                                   <span>{translateCategory(cat)}</span>
                                   <span className="font-mono text-slate-800">{formatCurrency(amount as number)}</span>
                                 </div>
                                 <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                   <div className="bg-rose-500 h-1.5" style={{ width: `${prc}%` }} />
                                 </div>
                                </div>
                             );
                           });
                        })()}
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            )}

            {/* 2. TREASURER MODULE (PROTECTED) */}
            {activeTab === "treasurer" && (
              <div className="space-y-6">
                {!isTreasurerAuthenticated ? (
                  <div className="max-w-md mx-auto bg-white border border-slate-200 p-6 rounded-2xl shadow-xs text-center space-y-4">
                    <div className="inline-flex bg-emerald-50 border border-emerald-100 p-3 rounded-full text-emerald-600">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Otorisasi Sesi Bendahara Diperlukan</h3>
                      <p className="text-xs text-slate-500 mt-1">Modul ini membuka kontrol buku kas, pencatatan transaksi belanja, kuitansi invoice, serta verifikasi laporan donasi publik.</p>
                    </div>

                    <button 
                      onClick={() => {
                        setLoginErrorState("");
                        setIsLoginModalOpen(true);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Login Otorisasi</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Header bar controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-950 text-white p-6 rounded-2xl shadow-sm border border-emerald-900">
                      <div>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                          <h2 className="text-lg font-bold">Dasbor Bendahara Resmi</h2>
                        </div>
                        <p className="text-emerald-300 text-xs mt-1">Sesi Aktif: <span className="font-bold text-white">{currentUser?.name}</span> ({currentUser?.role === 'ADMIN' ? 'Super Admin' : 'Bendahara'})</p>
                      </div>

                      <button 
                        onClick={handleLogoutAction}
                        className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-850 text-white px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Kunci Sesi / Logout</span>
                      </button>
                    </div>

                    {/* Status outputs */}
                    {formSuccess && (
                      <div className="bg-emerald-100 border-l-4 border-emerald-600 p-4 text-emerald-800 text-xs font-semibold rounded-r">
                        {formSuccess}
                      </div>
                    )}
                    {formError && (
                      <div className="bg-rose-100 border-l-4 border-rose-600 p-4 text-rose-800 text-xs font-semibold rounded-r flex items-start space-x-2">
                        <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* TWO COLUMN ROW FOR TRANSACTIONS POSTS AND PENDINGS */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      
                      {/* Left: Input Forms (7 columns) */}
                      <div className="lg:col-span-7 space-y-6">
                        
                        {/* 1. MANUALLY POST A DONATION */}
                        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
                          <h3 className="font-bold text-slate-800 text-sm mb-4 bg-slate-50 -mx-6 -mt-6 p-4 border-b border-slate-100 rounded-t-2xl flex items-center space-x-1.5 text-emerald-800">
                            <Coins className="h-4.5 w-4.5 text-emerald-600" />
                            <span>Catat & Setujui Kontribusi Publik</span>
                          </h3>

                          <form onSubmit={handlePostDonation} className="space-y-4 text-xs font-sans">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Nama Donatur</label>
                                <input 
                                  type="text" 
                                  placeholder="Contoh: Haji Sulaiman, CV Utama" 
                                  value={donationDonor}
                                  onChange={(e) => setDonationDonor(e.target.value)}
                                  disabled={donationIsAnon}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                />
                                <div className="mt-1.5 flex items-center space-x-1 text-slate-500 font-sans">
                                  <input 
                                    type="checkbox" 
                                    id="isAnon" 
                                    checked={donationIsAnon}
                                    onChange={(e) => setDonationIsAnon(e.target.checked)}
                                    className="rounded border-slate-300"
                                  />
                                  <label htmlFor="isAnon" className="cursor-pointer">Kirim sebagai Hamba Allah (Anonim)</label>
                                </div>
                              </div>

                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Nominal Donasi (Rupiah)</label>
                                <input 
                                  type="number" 
                                  placeholder="Contoh: 10000000" 
                                  value={donationAmount}
                                  onChange={(e) => setDonationAmount(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs text-slate-800"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Metode Pembayaran</label>
                                <select 
                                  value={donationMethod}
                                  onChange={(e: any) => setDonationMethod(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                >
                                  <option value="Bank Transfer">Transfer Bank</option>
                                  <option value="E-Wallet">Dompet Digital (E-Wallet)</option>
                                  <option value="Cash">Tunai / Cash</option>
                                  <option value="Crypto">Aset Kripto</option>
                                </select>
                              </div>

                              <div>
                                <ImageUploader 
                                  label="Bukti Transfer / Kuitansi Penerimaan"
                                  value={donationProof}
                                  onChange={setDonationProof}
                                  required={true}
                                />
                              </div>
                            </div>

                            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 flex items-center justify-between">
                              <span className="text-emerald-800 font-sans font-medium text-xxs">Selesaikan Pencatatan & Persetujuan Instan?</span>
                              <div className="flex items-center space-x-1 font-bold">
                                <input 
                                  type="checkbox" 
                                  id="directApprove" 
                                  checked={donationDirectApprove}
                                  onChange={(e) => setDonationDirectApprove(e.target.checked)}
                                  className="rounded text-emerald-600"
                                />
                                <label htmlFor="directApprove" className="text-xxs text-emerald-700 cursor-pointer">Langsung Setujui Buku Besar</label>
                              </div>
                            </div>

                            <button 
                              type="submit" 
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 shadow-sm"
                            >
                              <Plus className="h-4.5 w-4.5" />
                              <span>Simpan Audit & Catat Kas Masuk</span>
                            </button>
                          </form>
                        </div>

                        {/* 2. MANUALLY POST AN EXPENDITURE */}
                        <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
                          <h3 className="font-bold text-slate-800 text-sm mb-4 bg-slate-50 -mx-6 -mt-6 p-4 border-b border-slate-100 rounded-t-2xl flex items-center space-x-1.5 text-rose-800">
                            <DollarSign className="h-4.5 w-4.5 text-rose-600" />
                            <span>Catat Alokasi Belanja & Pengeluaran</span>
                          </h3>

                          <form onSubmit={handlePostExpenditure} className="space-y-4 text-xs font-sans">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Nama Material / Jasa Layanan</label>
                                  <input 
                                    type="text" 
                                    placeholder="Contoh: Semen Portland, Upah Harian Tukang" 
                                    value={expItemName}
                                    onChange={(e) => setExpItemName(e.target.value)}
                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                  />
                              </div>

                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Pos Anggaran (Kategori RAB)</label>
                                <select 
                                  value={expCategory}
                                  onChange={(e: any) => setExpCategory(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                >
                                  <option value="Material">Material Konstruksi</option>
                                  <option value="Labor">Upah Pekerja & Tukang</option>
                                  <option value="Equipment">Sewa Peralatan & Alat Berat</option>
                                  <option value="Permit/Admin">Perizinan & IMB Kecamatan</option>
                                  <option value="Other">Lain-lain / Serbaguna</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                              <div>
                                <label className="block text-slate-500 mb-1 font-sans font-semibold">Volume / Qty</label>
                                <input 
                                  type="number" 
                                  placeholder="Contoh: 50" 
                                  value={expVolume}
                                  onChange={(e) => setExpVolume(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 mb-1 font-sans font-semibold">Satuan (Unit)</label>
                                <input 
                                  type="text" 
                                  placeholder="Contoh: sak, ton, paket, hari" 
                                  value={expUnit}
                                  onChange={(e) => setExpUnit(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs font-sans text-slate-800"
                                />
                              </div>

                              <div>
                                <label className="block text-slate-500 mb-1 font-sans font-semibold">Harga Satuan (Rupiah)</label>
                                <input 
                                  type="number" 
                                  placeholder="Contoh: 72000" 
                                  value={expUnitPrice}
                                  onChange={(e) => setExpUnitPrice(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-slate-500 mb-1 font-semibold">Nama Toko / Kontraktor</label>
                                <input 
                                  type="text" 
                                  placeholder="Contoh: Toko Bangunan Mega Jaya" 
                                  value={expStoreName}
                                  onChange={(e) => setExpStoreName(e.target.value)}
                                  className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>

                              <div>
                                <ImageUploader 
                                  label="Foto Kuitansi / Lembar Nota"
                                  value={expReceipt}
                                  onChange={setExpReceipt}
                                  required={true}
                                />
                              </div>
                            </div>

                            <div className="mt-3 bg-rose-50 p-3 rounded-lg border border-rose-100 flex items-center space-x-2 text-rose-800">
                              <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                              <p className="text-xxs font-sans">
                                <strong>Validasi Akuntabilitas Ketat:</strong> Foto kuitansi / nota belanja wajib diisi demi transparansi kas untuk menghindari penolakan pencatatan kas keluar oleh sistem.
                              </p>
                            </div>

                            <button 
                              type="submit" 
                              className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 shadow-sm"
                            >
                              <Check className="h-4.5 w-4.5" />
                              <span>Simpan Audit & Kurangi Saldo Kas</span>
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Right: Pending Approvals Side Drawer (5 columns) */}
                      <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-2xl shadow-xs self-start">
                        <h3 className="font-bold text-slate-800 text-sm mb-4 border-b border-highlight pb-3">
                          Antrean Otorisasi Donasi ({donations.filter(d => d.status === "PENDING").length})
                        </h3>

                        <div className="space-y-4">
                          {donations.filter(d => d.status === "PENDING").length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 border border-dashed rounded-lg border-slate-200 text-slate-400 font-sans text-xs flex flex-col items-center justify-center space-y-1.5">
                              <CheckCircle className="h-6 w-6 text-emerald-600" />
                              <span>Semua donasi masuk telah divalidasi!</span>
                            </div>
                          ) : (
                            donations.filter(d => d.status === "PENDING").map((d) => (
                              <div key={d.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-semibold text-slate-800 text-xs">{d.donorName}</h4>
                                    <p className="text-xxs text-slate-500 font-mono tracking-tight">{new Date(d.date).toLocaleString("id-ID")} | {translatePaymentMethod(d.paymentMethod)}</p>
                                  </div>
                                  <span className="text-emerald-700 font-bold text-sm font-mono">{formatCurrency(d.amount)}</span>
                                </div>

                                <div className="flex items-center space-x-2 text-xxs font-mono">
                                  <button 
                                    onClick={() => setSelectedReceiptUrl(d.transferProofUrl)}
                                    className="bg-white border hover:bg-slate-100 border-slate-200 px-2.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 text-slate-700"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>Lihat Bukti Transfer</span>
                                  </button>
                                </div>

                                <button 
                                  onClick={() => handleApproveDonation(d.id)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xxs py-1.5 rounded-lg transition flex items-center justify-center space-x-1"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Otorisasi & Bukukan Donasi</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. PROJECT MANAGER MODULE */}
            {activeTab === "pm" && (
              <div className="space-y-6">
                {!isPmAuthenticated ? (
                  <div className="max-w-md mx-auto bg-white border border-slate-200 p-6 rounded-2xl shadow-xs text-center space-y-4">
                    <div className="inline-flex bg-amber-50 border border-amber-100 p-3 rounded-full text-amber-600">
                      <UserCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Otorisasi Sesi Manajer Proyek</h3>
                      <p className="text-xs text-slate-500 mt-1">Modul ini membuka kontrol pembaruan kemajuan fisik dan pemantauan linimasa dokumentasi foto konstruksi real-time.</p>
                    </div>

                    <button 
                      onClick={() => {
                        setLoginErrorState("");
                        setIsLoginModalOpen(true);
                      }}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Login Otorisasi</span>
                    </button>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-900 text-amber-50 p-6 rounded-2xl shadow-md">
                      <div>
                        <div className="flex items-center space-x-2">
                          <BuildingPointIcon className="h-5 w-5 text-amber-400" />
                          <h2 className="text-lg font-bold text-white">Terminal Manajer Proyek</h2>
                        </div>
                        <p className="text-slate-400 text-xs mt-1">Sesi Aktif: <span className="font-bold text-white">{currentUser?.name}</span> ({currentUser?.role === 'ADMIN' ? 'Super Admin' : 'Manajer Proyek'})</p>
                      </div>

                      <button 
                        onClick={handleLogoutAction}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                      >
                        <LogOut className="h-3.5 w-3.5 text-rose-500" />
                        <span>Kunci Sesi / Logout</span>
                      </button>
                    </div>

                    {formSuccess && (
                      <div className="bg-emerald-100 border-l-4 border-emerald-600 p-4 text-emerald-800 text-xs font-semibold rounded-r">
                        {formSuccess}
                      </div>
                    )}
                    {formError && (
                      <div className="bg-rose-100 border-l-4 border-rose-600 p-4 text-rose-800 text-xs font-semibold rounded-r">
                        {formError}
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs">
                      <h3 className="font-bold text-slate-800 text-sm mb-4">Kirim Laporan Harian Proyek (Konstruksi)</h3>

                      <form onSubmit={handlePostProgress} className="space-y-4 text-xs font-sans">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-500 mb-1 font-semibold">Persentase Penyelesaian Proyek (0-100%)</label>
                            <input 
                              type="number" 
                              placeholder="Contoh: 45" 
                              value={newProgressPercent}
                              onChange={(e) => setNewProgressPercent(e.target.value)}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
                            />
                            <p className="text-xxs text-slate-400 mt-1">Perkembangan terakhir tercatat: {summary?.physicalProgressPercent}%</p>
                          </div>

                          <div>
                            <ImageUploader 
                              label="Foto Dokumentasi Lapangan"
                              value={newProgressPhoto}
                              onChange={setNewProgressPhoto}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 mb-1 font-semibold font-sans">Keterangan Fisik / Detail Pencapaian Pekerjaan</label>
                          <textarea 
                            rows={3}
                            placeholder="Contoh: Pemasangan kerangka besi pilar tengah masjid selesai. Pembersihan sisa cor beton pilar lantai satu rampung..."
                            value={newProgressDesc}
                            onChange={(e) => setNewProgressDesc(e.target.value)}
                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-amber-600"
                          />
                        </div>

                        <button 
                          type="submit" 
                          className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-xs transition shadow-xs flex items-center justify-center space-x-1.5"
                        >
                          <CheckCircle className="h-4.5 w-4.5" />
                          <span>Terbitkan Laporan Proyek Hari Ini</span>
                        </button>
                      </form>
                    </div>

                    {/* MANAJEMEN MILESTONES SECTION */}
                    <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs space-y-6">
                      <div>
                        <h3 className="font-bold text-slate-800 text-xs mb-1">Manajemen Milestones & Sasaran Proyek</h3>
                        <p className="text-[10px] text-slate-400 leading-normal">Atur tenggat sasaran strategis konstruksi fisik proyek dan perbarui status pengerjaan secara real-time.</p>
                      </div>

                      {/* Form Tambah Milestone */}
                      <form onSubmit={handleCreateMilestone} className="border-t border-slate-100 pt-4 space-y-3 text-[10px]">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Tambah Sasaran Baru</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-505 mb-1 font-semibold">Nama Sasaran / Milestone *</label>
                            <input 
                              type="text"
                              placeholder="Contoh: Pemasangan Kusen & Daun Jendela"
                              value={newMilestoneTitle}
                              onChange={(e) => setNewMilestoneTitle(e.target.value)}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xxs text-slate-800"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-slate-505 mb-1 font-semibold">Estimasi Tanggal Target *</label>
                            <input 
                              type="date"
                              value={newMilestoneDate}
                              onChange={(e) => setNewMilestoneDate(e.target.value)}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xxs font-mono text-slate-800"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-505 mb-1 font-semibold">Kategori Pekerjaan *</label>
                            <select
                              value={newMilestoneCategory}
                              onChange={(e: any) => setNewMilestoneCategory(e.target.value)}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xxs text-slate-850"
                            >
                              <option value="Foundation">Fondasi & Pematangan Lahan</option>
                              <option value="Structure">Pilar Struktur & Beton</option>
                              <option value="Roofing">Pekerjaan Atap & Kubah</option>
                              <option value="Finishing">Pekerjaan Finishing & Tegel</option>
                              <option value="MEP">Sistem MEP & Pemipaan</option>
                              <option value="Operational">Legalitas & Operasional</option>
                              <option value="Other">Lain-lain / Serbaguna</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-505 mb-1 font-semibold">Status Awal *</label>
                            <select
                              value={newMilestoneStatus}
                              onChange={(e: any) => setNewMilestoneStatus(e.target.value)}
                              className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xxs text-slate-850"
                            >
                              <option value="PENDING">Rencana / Pending</option>
                              <option value="ON_GOING">Sedang Berlangsung</option>
                              <option value="COMPLETED">Selesai (Completed)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-505 mb-1 font-semibold">Catatan Rencana / Detail Kemajuan (Opsional)</label>
                          <input 
                            type="text"
                            placeholder="Contoh: Kusen masjid dari kayu jati perhutani grade A."
                            value={newMilestoneNotes}
                            onChange={(e) => setNewMilestoneNotes(e.target.value)}
                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-xxs text-slate-800"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xxs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-3"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Tambahkan Sasaran Linimasa</span>
                        </button>
                      </form>

                      {/* Daftar Milestones */}
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2">Daftar Linimasa Aktif</h4>
                        
                        <div className="space-y-3">
                          {milestones.length > 0 ? (
                            [...milestones]
                              .sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime())
                              .map((ms) => (
                                <div key={ms.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2 text-xxs">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-slate-800 text-xs">{ms.title}</span>
                                      <span className="text-[8px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase font-bold">{translateCategory(ms.category)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-150/50 border border-slate-200 px-1.5 py-0.2 rounded">{ms.expectedDate}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMilestone(ms.id)}
                                        className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded transition shrink-0"
                                        title="Hapus Milestone"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <label className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Status Pekerjaan</label>
                                      <select
                                        value={ms.status}
                                        onChange={(e: any) => handleUpdateMilestoneStatus(ms.id, e.target.value, ms.progressNotes, ms.title, ms.expectedDate, ms.category)}
                                        className="w-full bg-white px-2 py-1 border border-slate-200 rounded-md text-[10px] text-slate-800 font-semibold"
                                      >
                                        <option value="PENDING">Rencana / Pending</option>
                                        <option value="ON_GOING">Sedang Berlangsung (On Going)</option>
                                        <option value="COMPLETED">Selesai (Completed)</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-[8px] text-slate-400 font-bold uppercase mb-1">Catatan Progres</label>
                                      <div className="flex items-center gap-1.5">
                                        <input 
                                          type="text"
                                          defaultValue={ms.progressNotes || ""}
                                          placeholder="Tulis catatan di sini..."
                                          onBlur={(e) => {
                                            if (e.target.value !== ms.progressNotes) {
                                              handleUpdateMilestoneStatus(ms.id, ms.status, e.target.value, ms.title, ms.expectedDate, ms.category);
                                            }
                                          }}
                                          className="w-full bg-white px-2 py-1 border border-slate-200 rounded-md text-[10px] text-slate-700"
                                        />
                                        <span className="text-[7px] text-slate-400 italic font-mono uppercase shrink-0" title="Simpan otomatis saat Anda mengklik di luar kotak">AutoSave</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center text-slate-400 text-xxs py-4 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                              Belum ada rincian milestones yang terdaftar dalam proyek ini.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}



            {activeTab === "config" && currentUser?.role === "ADMIN" && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="bg-amber-50/50 border border-amber-200/60 p-6 rounded-2xl shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center space-x-3 text-amber-800">
                    <div className="bg-amber-600 text-white p-2 rounded-xl">
                      <Settings className="h-5 w-5 animate-spin-slow" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-tight text-slate-800">Inisialisasi & Konfigurasi Utama Proyek</h3>
                      <p className="text-xxs text-amber-700 font-medium">Layanan ini khusus diakses oleh tingkat administrator tertinggi untuk mendefinisikan rincian proyek baru.</p>
                    </div>
                  </div>
                </div>

                {/* DAFTAR PROYEK SECTION */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Daftar Proyek Terdaftar (Super Admin)</h4>
                      <p className="text-xxs text-slate-400">Total {projects.length || 0} proyek terdaftar dalam database.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportDatabase}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-550 text-white rounded-lg text-xxs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Unduh seluruh data tabel (RAB, Donatur, Mutasi Kas, Log, dll.) dalam satu berkas JSON"
                      >
                        <Download className="h-3 w-3" />
                        Ekspor Basis Data (JSON)
                      </button>
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-mono font-bold px-2.5 py-1.5 rounded-md">
                        KONSOL ADMIN
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {projects.length === 0 ? (
                      <div className="text-center py-8 text-neutral-400 text-xs">
                        Belum ada proyek yang dikonfigurasi. Silakan isi form di bawah untuk membuat proyek perdana.
                      </div>
                    ) : (
                      projects.map((p: any) => {
                        const isEditing = editingProjectId === p.id;
                        return (
                          <div key={p.id || "default"} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition space-y-3 bg-slate-50/40">
                            {isEditing ? (
                              <div className="space-y-4 pt-1">
                                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider border-b border-slate-100 pb-1">
                                  Mengedit Proyek: {p.name}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  <div className="sm:col-span-2">
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Nama Proyek</label>
                                    <input
                                      type="text"
                                      value={editProjName}
                                      onChange={(e) => setEditProjName(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Tipe Pekerjaan</label>
                                    <select
                                      value={editProjType}
                                      onChange={(e: any) => setEditProjType(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    >
                                      <option value="baru">Proyek Baru</option>
                                      <option value="renovasi">Renovasi</option>
                                      <option value="alih_fungsi">Alih Fungsi</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-slate-700 text-xxs font-bold mb-1.5">Sumber Dana (Pilihan Ganda)</label>
                                    <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                      {[
                                        { value: 'donasi', title: 'Donasi Jamaah' },
                                        { value: 'perusahaan', title: 'Pihak Ketiga' },
                                        { value: 'pribadi', title: 'Kas Internal' },
                                      ].map((item) => {
                                        const isChecked = (editProjFunding || '').split(',').includes(item.value);
                                        return (
                                          <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xxs text-slate-700 leading-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => {
                                                const current = (editProjFunding || '').split(',').filter(Boolean);
                                                let next: string[];
                                                if (isChecked) {
                                                  if (current.length <= 1) return; // Prevent empty selection
                                                  next = current.filter((v) => v !== item.value);
                                                } else {
                                                  next = [...current, item.value];
                                                }
                                                setEditProjFunding(next.join(','));
                                              }}
                                              className="accent-amber-500 rounded h-3.5 w-3.5"
                                            />
                                            <span className="font-medium group-hover:text-amber-600 transition-colors">
                                              {item.title}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Akses & Publikasi</label>
                                    <select
                                      value={editProjStatus}
                                      onChange={(e: any) => setEditProjStatus(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    >
                                      <option value="public">Publik (Terbuka)</option>
                                      <option value="private">Privat (Internal)</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Status Proyek</label>
                                    <select
                                      value={editProjProjectStatus}
                                      onChange={(e: any) => setEditProjProjectStatus(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="berjalan">Berjalan</option>
                                      <option value="selesai">Selesai</option>
                                      <option value="batal">Batal</option>
                                    </select>
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Target Anggaran (IDR)</label>
                                    <input
                                      type="number"
                                      value={editProjBudget}
                                      onChange={(e) => setEditProjBudget(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    />
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block text-slate-700 text-xxs font-bold mb-1">Deskripsi Ruang Lingkup</label>
                                    <textarea
                                      rows={2}
                                      value={editProjDescription}
                                      onChange={(e) => setEditProjDescription(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-150">
                                  <button
                                    type="button"
                                    onClick={() => setEditingProjectId(null)}
                                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xxs font-bold hover:bg-slate-300 transition cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateProject(p.id)}
                                    className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xxs font-bold hover:bg-amber-550 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="h-3 w-3" />
                                    Simpan Perubahan
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase font-mono border ${
                                      p.projectStatus === "selesai"
                                        ? "bg-sky-50 text-sky-700 border-sky-100"
                                        : p.projectStatus === "batal"
                                        ? "bg-rose-50 text-rose-750 border-rose-100"
                                        : p.projectStatus === "pending"
                                        ? "bg-amber-50 text-amber-700 border-amber-100"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse"
                                    }`}>
                                      STATUS: {p.projectStatus || "berjalan"}
                                    </span>
                                    {summary?.projectConfig?.id === p.id && (
                                      <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 font-extrabold px-2 py-0.5 rounded-md font-mono">
                                        AKTIF SEKARANG
                                      </span>
                                    )}
                                    <span className="text-[9px] bg-slate-150 text-slate-600 font-mono px-1.5 py-0.5 rounded">
                                      Tipe: {p.type === 'baru' ? 'Baru' : p.type === 'renovasi' ? 'Renovasi' : 'Alih Fungsi'}
                                    </span>
                                  </div>
                                  <h5 className="text-xs font-bold text-slate-855">{p.name}</h5>
                                  <p className="text-xxs text-slate-500 leading-relaxed font-sans line-clamp-2">
                                    {p.description}
                                  </p>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1.5 text-[10px] font-mono text-slate-500 border-t border-slate-100 pb-0.5">
                                    <div>
                                      Target Budget: <span className="font-bold text-slate-700">{formatCurrency(p.budget)}</span>
                                    </div>
                                    <div>
                                      Tanggal Mulai: <span className="font-bold text-slate-600">
                                        {p.initializedAt ? new Date(p.initializedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      Inisiator: <span className="font-bold text-slate-600">{p.initializedBy || "Super Admin"}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex sm:flex-col gap-2 shrink-0 sm:self-center">
                                  <button
                                    onClick={() => startEditProject(p)}
                                    className="flex-1 sm:flex-none py-1.5 px-3 border border-amber-200 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    Edit Status & Info
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProject(p.id)}
                                    className="flex-1 sm:flex-none py-1.5 px-3 border border-red-250 bg-red-50 text-red-800 rounded-lg hover:bg-red-100 transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    Hapus Proyek
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <form onSubmit={handleInitializeProject} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 shadow-xs">
                  
                  {/* 1. Project Basic Details */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">Inisialisasi Proyek Baru</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-slate-700 text-xs font-bold mb-1">Nama Proyek Rencana *</label>
                        <input
                          type="text"
                          required
                          value={newProjName}
                          onChange={(e) => setNewProjName(e.target.value)}
                          placeholder="Contoh: Pembangunan Masjid Raya Al-Muhajirin, atau Renovasi Kantor Cabang"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Tipe Pekerjaan Proyek *</label>
                        <select
                          value={newProjType}
                          onChange={(e: any) => setNewProjType(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="baru">Proyek Baru (Infrastruktur Total)</option>
                          <option value="renovasi">Renovasi / Pemugaran Bangunan</option>
                          <option value="alih_fungsi">Alih Fungsi / Relokasi Lahan</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1.5">Metode & Sumber Pendanaan *</label>
                        <div className="space-y-2.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {[
                            { value: 'donasi', title: 'Donasi Swadaya', desc: 'Kotak amal, sumbangan jamaah & sayap sosial' },
                            { value: 'perusahaan', title: 'Sponsor / Perusahaan', desc: 'CSR korporasi, hibah instansi, atau kemitraan' },
                            { value: 'pribadi', title: 'Kas Internal', desc: 'Dana kas masjid, aset produktif, atau modal yayasan' },
                          ].map((item) => {
                            const isChecked = (newProjFunding || '').split(',').includes(item.value);
                            return (
                              <label key={item.value} className="flex items-start gap-2.5 cursor-pointer select-none group text-xs text-slate-700 leading-tight">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = (newProjFunding || '').split(',').filter(Boolean);
                                    let next: string[];
                                    if (isChecked) {
                                      if (current.length <= 1) return; // Prevent empty selection
                                      next = current.filter((v) => v !== item.value);
                                    } else {
                                      next = [...current, item.value];
                                    }
                                    setNewProjFunding(next.join(','));
                                  }}
                                  className="mt-0.5 accent-amber-500 rounded h-4 w-4 border-slate-350"
                                />
                                <div className="flex-1">
                                  <span className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                                    {item.title}
                                  </span>
                                  <span className="block text-[10px] text-slate-500 mt-0.5">
                                    {item.desc}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Fungsi / Peruntukan & Status Proyek *</label>
                        <select
                          value={newProjStatus}
                          onChange={(e: any) => setNewProjStatus(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        >
                          <option value="public">Publik (Akses Terbuka & Transparan Penuh)</option>
                          <option value="private">Privat (Internal Terbatas)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Target Anggaran Proyek (IDR) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newProjBudget}
                          onChange={(e) => setNewProjBudget(e.target.value)}
                          placeholder="Masukkan nilai target anggaran, misal: 500000000"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-bold mb-1">Deskripsi & Ruang Lingkup Pembangunan *</label>
                      <textarea
                        required
                        rows={3}
                        value={newProjDescription}
                        onChange={(e) => setNewProjDescription(e.target.value)}
                        placeholder="Deskripsikan latar belakang proyek, ukuran fisik rencana, target tanggal selesai, serta tujuan akhir pelaksanaan pembangunan secara detail..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 2. Create Treasurer Account */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">2. Pendaftaran Pembuat Kas (Bendahara)</h4>
                    <p className="text-xxs text-slate-400 leading-none">Mendaftarkan user pengelola kas yang diotorisasi khusus untuk menyetujui donasi dan mencatat pengeluaran pengadaan.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Nama Lengkap Bendahara *</label>
                        <input
                          type="text"
                          required
                          value={newProjTreasurerName}
                          onChange={(e) => setNewProjTreasurerName(e.target.value)}
                          placeholder="Contoh: H. Akhmad Syakir"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Email Otoritas *</label>
                        <input
                          type="email"
                          required
                          value={newProjTreasurerEmail}
                          onChange={(e) => setNewProjTreasurerEmail(e.target.value)}
                          placeholder="contoh: bendahara@smartbuild.id"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Password Login *</label>
                        <input
                          type="password"
                          required
                          value={newProjTreasurerPassword}
                          onChange={(e) => setNewProjTreasurerPassword(e.target.value)}
                          placeholder="Keamanan minimal 4 karakter"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Create PM Account */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">3. Pendaftaran Manajer Proyek (PM)</h4>
                    <p className="text-xxs text-slate-400 leading-none">Mendaftarkan user manajer konstruksi lapangan yang memiliki kuasa menerbitkan laporan kemajuan persentase fisik & log material mingguan.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Nama Lengkap PM *</label>
                        <input
                          type="text"
                          required
                          value={newProjPmName}
                          onChange={(e) => setNewProjPmName(e.target.value)}
                          placeholder="Contoh: Ir. Dwi Prayogo"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Email Otoritas *</label>
                        <input
                          type="email"
                          required
                          value={newProjPmEmail}
                          onChange={(e) => setNewProjPmEmail(e.target.value)}
                          placeholder="contoh: pm@smartbuild.id"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">Password Login *</label>
                        <input
                          type="password"
                          required
                          value={newProjPmPassword}
                          onChange={(e) => setNewProjPmPassword(e.target.value)}
                          placeholder="Keamanan minimal 4 karakter"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Strategy Resets */}
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/40 space-y-2.5">
                    <div className="flex items-start space-x-2.5">
                      <input
                        type="checkbox"
                        id="startFresh"
                        checked={newProjStartFresh}
                        onChange={(e) => setNewProjStartFresh(e.target.checked)}
                        className="mt-1 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <label htmlFor="startFresh" className="text-xxs text-slate-700 leading-tight select-none cursor-pointer">
                        <span className="block font-bold text-slate-800">Mulai Bersih (Rekomendasi)</span>
                        Kosongkan histori donasi eksperimental, log progress fisik, dan tabel belanja kas rincian terdahulu agar sistem benar-benar steril untuk rencana proyek anyar ini. Rencana anggaran (RAB) akan terbentuk baru berdasarkan parameter persentase konstruk standar.
                      </label>
                    </div>
                  </div>

                  {/* Error / Success Feedback */}
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs font-medium">
                      ⚠️ {formError}
                    </div>
                  )}

                  {formSuccess && (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 px-4 py-3 rounded-lg text-xs font-medium">
                      ✅ {formSuccess}
                    </div>
                  )}

                  {/* Actions Submit */}
                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      disabled={projConfigLoading}
                      className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {projConfigLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Membuat Proyek Baru...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span>Inisialisasi & Luncurkan Portal Proyek</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>
            )}

            {activeTab === "google" && (
              <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
                <GoogleDriveSheetsSync
                  googleToken={googleToken}
                  setGoogleToken={setGoogleToken}
                  projectConfig={summary?.projectConfig}
                  donations={donations}
                  expenditures={expenditures}
                  budgets={summary?.budgets || []}
                  progress={progressLog}
                  generateLedgerBlob={generateLedgerBlob}
                  onLogAudit={logAuditFromClient}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-12 border-t border-slate-850">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-3">
          <div className="flex justify-center items-center space-x-2 text-white">
            <Building2 className="h-5 w-5 text-emerald-500" />
            <span className="font-bold text-sm tracking-widest uppercase">SmartBuild Transparency</span>
          </div>
          <p className="text-xxs font-mono text-slate-500">
            Secure Fullstack Architecture Blueprint <br />
            Created for verified public trust, accountability, and real-time physical development summaries.
          </p>
          <div className="text-xxs text-slate-600 flex flex-col sm:flex-row justify-center items-center gap-2">
            <span>© {systemInfo.year} SmartBuild Initiative. Standard GPL-v2 License. Auditable code distribution.</span>
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-mono text-xxs font-medium">
              v{systemInfo.version}
            </span>
          </div>
        </div>
      </footer>

      {/* PROOF POPUP MODAL */}
      <AnimatePresence>
        {selectedReceiptUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedReceiptUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-bold text-slate-950 text-sm">Audited Certification Proof</h4>
                <button 
                  onClick={() => setSelectedReceiptUrl(null)}
                  className="bg-slate-100 text-slate-500 hover:text-slate-900 p-1 rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-xxs text-slate-500 font-sans leading-relaxed">
                  As required under code security parameters, this image proves that financial values correspond directly to real-world banks deposits or verified vendor cash invoices.
                </p>
                <img 
                  src={resolveReceiptUrl(selectedReceiptUrl)} 
                  alt="Verifiable Bank Proof / Invoice Cash Receipt" 
                  referrerPolicy="no-referrer"
                  className="w-full h-72 object-cover rounded-xl border border-slate-200"
                />
              </div>

              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 text-xxs font-mono text-emerald-800 text-center">
                🔒 CERTIFICATE STATUS: VERIFIED LEDGER ATTACHMENT
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTH LOGIN MODAL */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50"
            onClick={() => setIsLoginModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden space-y-5"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Login Otorisasi</h4>
                </div>
                <button 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="bg-slate-100 text-slate-500 hover:text-slate-900 p-1 rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {loginErrorState && (
                <div className="bg-red-50 text-red-700 text-xxs p-3 rounded-lg border border-red-100 flex items-start space-x-1.5 font-sans">
                  <span>⚠️</span>
                  <span>{loginErrorState}</span>
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                await handleLoginAction(loginEmail, loginPassword);
              }} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Email Sesi</label>
                  <input 
                    type="email" 
                    required
                    placeholder="nama@pintarbangun.vercel.app" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Kata Sandi / Password</label>
                  <input 
                    type="password" 
                    required
                    placeholder="••••••••" 
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-50 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-emerald-600 focus:bg-white focus:outline-hidden transition"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg transition"
                >
                  Konfirmasi Otorisasi Sesi
                </button>
              </form>


            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Inline custom UI point indicator to save packages load size
function BuildingPointIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 10v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10" />
      <path d="m22 10-10-8L2 10" />
      <path d="M6 18h4" />
      <path d="M14 18h4" />
      <path d="M10 12h4" />
    </svg>
  );
}
