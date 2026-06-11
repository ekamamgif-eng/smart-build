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
  Cog,
  Download,
  Cloud,
  QrCode,
  Smartphone,
  Database,
  Crown,
  Lightbulb,
  ShieldCheck,
  Hammer,
  AlertCircle,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import { 
  RABItem, 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  AuditLog,
  Milestone,
  BankAccount
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

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-800 font-mono text-xs">
        <p className="font-sans font-bold text-slate-350 mb-1.5">{label}</p>
        {payload.map((pld: any) => (
          <div key={pld.name} className="flex justify-between gap-6 py-0.5">
            <span className="capitalize" style={{ color: pld.color }}>
              ● {pld.name}:
            </span>
            <span className="font-bold">{formatCurrency(pld.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
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
    "E-Wallet": "QRIS/Dompet Digital",
    Cash: "Tunai",
    Crypto: "Kripto"
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "treasurer" | "pm" | "setting">("dashboard");
  const [settingSubTab, setSettingSubTab] = useState<"project" | "rekening" | "google" | "keamanan">("project");
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
    version: "2.0.0",
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

  // Public donation gateway states
  const [isPublicGatewayOpen, setIsPublicGatewayOpen] = useState(false);
  const [publicDonorName, setPublicDonorName] = useState("");
  const [publicDonorIsAnon, setPublicDonorIsAnon] = useState(false);
  const [publicDonationAmount, setPublicDonationAmount] = useState("50000");
  const [publicDonationMethod, setPublicDonationMethod] = useState<"Bank Transfer" | "E-Wallet" | "Cash" | "Crypto">("Bank Transfer");
  const [publicDonationProof, setPublicDonationProof] = useState("");
  const [qrAmountPreset, setQrAmountPreset] = useState("50000");
  const [publicGatewayError, setPublicGatewayError] = useState("");
  const [publicGatewaySuccess, setPublicGatewaySuccess] = useState("");
  const [publicGatewaySubmitting, setPublicGatewaySubmitting] = useState(false);

  // Bank accounts states & management
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null);
  const [bankNameForm, setBankNameForm] = useState("");
  const [bankNumberForm, setBankNumberForm] = useState("");
  const [bankHolderForm, setBankHolderForm] = useState("");
  const [bankQrUrlForm, setBankQrUrlForm] = useState("");
  const [bankIsActiveForm, setBankIsActiveForm] = useState(true);

  // Visibility & auto backup state variables
  const [visibilityMode, setVisibilityMode] = useState<"single" | "multiple">("single");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [publicProjects, setPublicProjects] = useState<Array<{ id: string, name: string }>>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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
  const [newProjStartFresh, setNewProjStartFresh] = useState(false);
  const [startFreshConfirmText, setStartFreshConfirmText] = useState("");
  const [showStartFreshModal, setShowStartFreshModal] = useState(false);
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

  const fetchPublicProjects = async () => {
    try {
      const res = await fetch("/api/public-projects");
      if (res.ok) {
        const data = await res.json();
        setPublicProjects(data);
      }
    } catch (e) {
      console.error("Gagal memuat proyek publik:", e);
    }
  };

  const fetchVisibilitySettings = async () => {
    try {
      const res = await fetch("/api/visibility-settings");
      if (res.ok) {
        const data = await res.json();
        setVisibilityMode(data.visibilityMode || "single");
      }
    } catch (e) {
      console.error("Gagal memuat mode visibilitas:", e);
    }
  };

  // Fetch core data from full-stack APIs
  const fetchAllData = async (tokenOverride?: string | null, forceProjectId?: string) => {
    try {
      setLoading(true);
      const activeToken = tokenOverride !== undefined ? tokenOverride : authToken;
      const headersOpt = activeToken ? { "Authorization": `Bearer ${activeToken}` } : {};
      
      const projIdToUse = forceProjectId !== undefined ? forceProjectId : selectedProjectId;
      const q = projIdToUse ? `?projectId=${projIdToUse}` : "";

      // Fetch public projects and visibility mode in parallel
      fetchPublicProjects();
      fetchVisibilitySettings();

      const [sumRes, donRes, expRes, progRes, auditRes, sysRes, mileRes, bankRes] = await Promise.all([
        fetch(`/api/financial-summary${q}`, { headers: headersOpt }),
        fetch(`/api/donations${q}`, { headers: headersOpt }),
        fetch(`/api/expenditures${q}`, { headers: headersOpt }),
        fetch(`/api/progress${q}`, { headers: headersOpt }),
        fetch(`/api/audit-logs${q}`, { headers: headersOpt }),
        fetch("/api/system-info"),
        fetch(`/api/milestones${q}`, { headers: headersOpt }),
        fetch("/api/bank-accounts")
      ]);

      const sumData = await sumRes.json();
      const donData = await donRes.json();
      const expData = await expRes.json();
      const progData = await progRes.json();
      const auditData = await auditRes.json();
      const mileData = mileRes.ok ? await mileRes.json() : [];
      const bankData = bankRes.ok ? await bankRes.json() : [];
      let sysData = { version: "2.0.0", year: new Date().getFullYear() };
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
      setBankAccounts(bankData);

      if (activeToken) {
        try {
          const [projRes, profileRes, backupRes] = await Promise.all([
            fetch("/api/projects", { headers: headersOpt }),
            fetch("/api/auth/me", { headers: headersOpt }),
            fetch("/api/backups", { headers: headersOpt })
          ]);
          
          if (projRes.status === 401 || projRes.status === 403 || profileRes.status === 401 || profileRes.status === 403) {
            console.warn("Session expired or token is invalid on server, clearing stale credentials.");
            localStorage.removeItem("auth_token");
            localStorage.removeItem("current_user");
            setAuthToken(null);
            setCurrentUser(null);
            setProjects([]);
            setActiveTab("dashboard");
            return;
          }

          if (projRes.ok) {
            const projData = await projRes.json();
            setProjects(projData);
          }
          if (backupRes.ok) {
            const backupData = await backupRes.json();
            setBackupsList(backupData);
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

  // Listen for mobile QR scanner URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pay") === "donation") {
      const amount = params.get("amount") || "50000";
      setPublicDonationAmount(amount);
      setQrAmountPreset(amount);
      setPublicDonorIsAnon(false);
      setPublicDonorName("");
      setPublicDonationMethod("Bank Transfer");
      setPublicDonationProof("");
      setPublicGatewayError("");
      setPublicGatewaySuccess("");
      setIsPublicGatewayOpen(true);
      
      // Quietly clean up search params from the address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handlePublicDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublicGatewayError("");
    setPublicGatewaySuccess("");
    setPublicGatewaySubmitting(true);

    const nameToSubmit = publicDonorIsAnon ? "Hamba Allah" : publicDonorName.trim();
    if (!publicDonorIsAnon && !nameToSubmit) {
      setPublicGatewayError("Nama donatur wajib diisi, atau silakan pilih sebagai Hamba Allah (Anonim).");
      setPublicGatewaySubmitting(false);
      return;
    }

    const amt = Number(publicDonationAmount);
    if (!publicDonationAmount || isNaN(amt) || amt <= 0) {
      setPublicGatewayError("Nominal donasi harus merupakan nilai positif.");
      setPublicGatewaySubmitting(false);
      return;
    }

    if (!publicDonationProof.trim()) {
      setPublicGatewayError("Aturan Transparansi Ketat: Harap unggah bukti transfer bank atau kuitansi untuk memvalidasi donasi.");
      setPublicGatewaySubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          donorName: nameToSubmit,
          isAnonymous: publicDonorIsAnon,
          amount: amt,
          paymentMethod: publicDonationMethod,
          transferProofUrl: publicDonationProof,
          approveDirectly: false
        })
      });

      if (response.ok) {
        setPublicGatewaySuccess(`Alhamdulillah! Donasi sebesar Rp ${amt.toLocaleString("id-ID")} berhasil diajukan dalam antrean bendahara.`);
        setPublicDonorName("");
        setPublicDonorIsAnon(false);
        setPublicDonationProof("");
        fetchAllData();
        
        setTimeout(() => {
          setIsPublicGatewayOpen(false);
          setPublicGatewaySuccess("");
        }, 5000);
      } else {
        const err = await response.json();
        setPublicGatewayError(err.error || "Gagal mendaftarkan laporan donasi.");
      }
    } catch (err) {
      setPublicGatewayError("Gangguan koneksi database.");
    } finally {
      setPublicGatewaySubmitting(false);
    }
  };

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
    setActiveTab("dashboard");
    setFormSuccess("Sesi Anda telah ditutup dengan aman.");
    setTimeout(() => setFormSuccess(""), 4000);
    fetchAllData(null);
  };

  const handleSaveBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!bankNameForm.trim() || !bankNumberForm.trim() || !bankHolderForm.trim()) {
      setFormError("Nama Bank, Nomor Rekening, dan Pemilik Rekening wajib diisi!");
      return;
    }

    try {
      const isEditing = editingBankAccountId !== null;
      const url = isEditing ? `/api/bank-accounts/${editingBankAccountId}` : "/api/bank-accounts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          bankName: bankNameForm,
          accountNumber: bankNumberForm,
          accountHolder: bankHolderForm,
          qrCodeUrl: bankQrUrlForm,
          isActive: bankIsActiveForm
        })
      });

      if (res.ok) {
        setFormSuccess(isEditing ? "Rekening bank berhasil dicatatkan ulang!" : "Rekening bank baru berhasil dipasang!");
        setBankNameForm("");
        setBankNumberForm("");
        setBankHolderForm("");
        setBankQrUrlForm("");
        setBankIsActiveForm(true);
        setEditingBankAccountId(null);
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const errorData = await res.json();
        setFormError(errorData.error || "Gagal menyimpan rekening bank.");
      }
    } catch (err) {
      setFormError("Gagal menyimpan rekening bank akibat gangguan koneksi.");
    }
  };

  const handleEditBankAccount = (account: BankAccount) => {
    setEditingBankAccountId(account.id);
    setBankNameForm(account.bankName);
    setBankNumberForm(account.accountNumber);
    setBankHolderForm(account.accountHolder);
    setBankQrUrlForm(account.qrCodeUrl || "");
    setBankIsActiveForm(account.isActive);
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus rekening bank ini dari portal tujuan donasi?")) {
      return;
    }
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, {
        method: "DELETE",
        headers: {
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        }
      });
      if (res.ok) {
        setFormSuccess("Rekening bank berhasil dihapus!");
        fetchAllData();
        setTimeout(() => setFormSuccess(""), 4000);
      } else {
        const errorData = await res.json();
        setFormError(errorData.error || "Gagal menghapus rekening bank.");
      }
    } catch (err) {
      setFormError("Gagal menghapus rekening bank akibat gangguan koneksi.");
    }
  };

  const executeProjectInitialization = async () => {
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
        setStartFreshConfirmText(""); // Reset text verification

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
      setShowStartFreshModal(false);
    }
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

    // Checking if start fresh is checked without valid confirm text typing
    if (newProjStartFresh) {
      if (startFreshConfirmText !== "STERILKAN DATABASE") {
        setFormError("Anda harus mengetik 'STERILKAN DATABASE' di kolom konfirmasi Zona Bahaya untuk melanjutkan.");
        return;
      }
      // Open the visual modal/dialog for deep confirmation before executing
      setShowStartFreshModal(true);
      return;
    }

    // Normal non-destructive flow
    await executeProjectInitialization();
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

  const handleActivateProject = async (id: string) => {
    try {
      setFormError("");
      setFormSuccess("");

      const headersOpt = authToken ? { 
        "Authorization": `Bearer ${authToken}`
      } : {};

      const response = await fetch(`/api/projects/${id}/activate`, {
        method: "POST",
        headers: headersOpt
      });

      if (response.ok) {
        setFormSuccess("Proyek berhasil diaktifkan! Mengalihkan tampilan...");
        setTimeout(() => setFormSuccess(""), 5000);
        // Refresh everything
        fetchAllData();
      } else {
        const err = await response.json();
        setFormError(err.error || "Gagal mengaktifkan proyek.");
      }
    } catch (err) {
      console.error("Error activating project", err);
      setFormError("Gagal mengaktifkan proyek karena masalah koneksi.");
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

  // Aggregated donations and expenditures by month for recharts trend lines
  const getMonthlyTrends = () => {
    const monthsMap: Record<string, { donations: number; expenditures: number; dateVal: Date }> = {};

    // Donasi
    donations.forEach((d) => {
      if (d.status === 'APPROVED' || !d.status) { // Count approved donations
        const date = new Date(d.date);
        if (isNaN(date.getTime())) return;
        
        const year = date.getFullYear();
        const monthIndex = date.getMonth(); // 0-11
        const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
        
        if (!monthsMap[key]) {
          monthsMap[key] = { donations: 0, expenditures: 0, dateVal: new Date(year, monthIndex, 1) };
        }
        monthsMap[key].donations += d.amount;
      }
    });

    // Pengeluaran
    expenditures.forEach((e) => {
      const date = new Date(e.date);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      if (!monthsMap[key]) {
        monthsMap[key] = { donations: 0, expenditures: 0, dateVal: new Date(year, monthIndex, 1) };
      }
      monthsMap[key].expenditures += e.totalPrice;
    });

    const indonesianMonths = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", 
      "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
    ];

    const chartData = Object.keys(monthsMap)
      .sort() // sort YYYY-MM
      .map((key) => {
        const item = monthsMap[key];
        const monthLabel = indonesianMonths[item.dateVal.getMonth()];
        const yearLabel = item.dateVal.getFullYear().toString().substring(2);
        return {
          key,
          name: `${monthLabel} '${yearLabel}`,
          Donasi: item.donations,
          Pengeluaran: item.expenditures,
        };
      });

    // Fallback if chartData is empty, return last 6 months with 0 value
    if (chartData.length === 0) {
      const now = new Date();
      const results = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthLabel = indonesianMonths[d.getMonth()];
        const yearLabel = d.getFullYear().toString().substring(2);
        results.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          name: `${monthLabel} '${yearLabel}`,
          Donasi: 0,
          Pengeluaran: 0
        });
      }
      return results;
    }

    return chartData;
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
      <header className="sticky top-0 z-40 h-16 lg:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 shadow-xs">
        {/* Left Side: Branding */}
        <div className="flex items-center gap-2.5 cursor-pointer flex-shrink-0" onClick={() => setActiveTab("dashboard")}>
          <img 
            src={projectLogo} 
            alt="SmartBuild Logo" 
            className="h-8 w-8 lg:h-9 lg:w-9 object-contain flex-shrink-0"
            referrerPolicy="no-referrer" 
          />
          <div>
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-slate-800 leading-none">
              <span className="text-emerald-600 font-extrabold">SmartBuild</span>
            </h1>
          </div>
        </div>

        {/* Center Side: Desktop Portal Tabs */}
        <nav className="hidden lg:flex space-x-1.5 bg-slate-100 p-1 rounded-xl">
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
            Manajer Proyek
          </button>
          {currentUser?.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab("setting")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                activeTab === "setting"
                  ? "bg-amber-100 text-amber-900 shadow-sm border border-amber-200"
                  : "text-amber-700 hover:text-amber-900 hover:bg-amber-50"
              }`}
            >
              <Cog className="h-3.5 w-3.5 text-amber-500" />
              <span>Pengaturan Admin</span>
            </button>
          )}
        </nav>

        {/* Right Side: Integrity status */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="text-right hidden xl:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">DATABASE</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold italic justify-end">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> AKTIF
            </p>
          </div>
          <div className="h-10 w-px bg-slate-200 hidden xl:block"></div>
          
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden lg:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</p>
                <div className="flex items-center gap-1 justify-end font-mono font-extrabold text-amber-600 leading-none mt-1">
                  {currentUser.role === 'ADMIN' ? (
                    <>
                      <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-[10px]">ADMIN</span>
                    </>
                  ) : currentUser.role === 'TREASURER' ? (
                    <>
                      <Coins className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-[10px]">BENDAHARA</span>
                    </>
                  ) : (
                    <>
                      <Hammer className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="text-[10px]">PROJECT MANAGER</span>
                    </>
                  )}
                </div>
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
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              <span>Login</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Actions Ribbon */}
      <div className="lg:hidden sticky top-16 z-30 bg-white border-b border-slate-200 flex overflow-x-auto whitespace-nowrap py-2.5 px-4 space-x-2 scrollbar-none">
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
            onClick={() => setActiveTab("setting")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
              activeTab === "setting" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Cog className="h-3.5 w-3.5" />
            <span>Pengaturan</span>
          </button>
        )}
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
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Public Project Selector Dropdown */}
                    {visibilityMode === "multiple" && publicProjects.length > 0 && (
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                        <label htmlFor="public-project-selector" className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono">
                          Pilih Proyek:
                        </label>
                        <select
                          id="public-project-selector"
                          value={selectedProjectId || (summary?.projectConfig?.id || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedProjectId(val);
                            fetchAllData(undefined, val);
                          }}
                          className="text-xs font-semibold bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 focus:outline-hidden focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="">-- Proyek Utama Aktif --</option>
                          {publicProjects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {summary?.projectConfig?.initialized && (
                      <div className="flex items-center gap-2 font-mono text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                        <span className="font-bold tracking-wider uppercase">PELACAKAN AKTIF</span>
                      </div>
                    )}
                  </div>
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
                        <span className="text-xs font-bold text-slate-700">{summary.projectConfig.initializedBy || 'Admin'}</span>
                      </div>
                      <div>
                        <span className="block font-bold text-slate-400 text-[9px] uppercase tracking-wider font-mono">Pelacakan Lapangan</span>
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
                      Sistem mendeteksi bahwa saat ini tidak ada proyek pembangunan yang terdaftar di basis data. Silakan masuk / login sebagai <span className="font-bold text-slate-800">Admin</span> dan buka menu <span className="font-bold text-amber-700">Inisialisasi Proyek</span> untuk menambahkan proyek pertama Anda.
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

                {/* Monthly Trend Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="bg-emerald-100 text-emerald-700 rounded-lg p-2 flex items-center justify-center">
                        <Coins className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">Tren Akumulasi & Mutasi Bulanan</h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Visualisasi perbandingan total donasi masuk vs belanja pengeluaran</p>
                      </div>
                    </div>
                    {/* Inline chart legend */}
                    <div className="flex items-center gap-4 text-[11px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                        <span className="text-slate-600">Donasi Masuk</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                        <span className="text-slate-600">Total Pengeluaran</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-64 w-full pt-1.5 min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={getMonthlyTrends()}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorDonasi" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8" 
                          fontSize={10}
                          fontFamily="monospace"
                          tickLine={false}
                          axisLine={false}
                          dy={8}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={9}
                          fontFamily="monospace"
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => {
                            if (val >= 1_000_000_000) return `Rp ${(val / 1_000_000_000).toFixed(1)}M`;
                            if (val >= 1_000_000) return `Rp ${(val / 1_000_000).toFixed(0)}jt`;
                            if (val >= 1_000) return `Rp ${(val / 1_000).toFixed(0)}rb`;
                            return `Rp ${val}`;
                          }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="Donasi" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorDonasi)" 
                          activeDot={{ r: 5 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Pengeluaran" 
                          stroke="#f43f5e" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorPengeluaran)" 
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Visual Ledger Splits (Full width main table + double-column secondary grid below) */}
                <div className="space-y-6">
                  
                  {/* Ledger Table (Full Width) */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-700 truncate sm:whitespace-normal">Buku Transparansi Kas Publik</h3>
                        <p className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider leading-relaxed mt-1 sm:whitespace-normal">Snapshot riwayat mutasi dari database cloud terverifikasi</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:justify-end">
                        <div className="relative flex-1 min-w-[140px] md:flex-none">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="Cari nama atau ID..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="text-xs border border-slate-200 rounded px-3 py-1.5 pl-8 w-full md:w-44 bg-white focus:outline-hidden focus:border-emerald-600"
                          />
                        </div>
                        <div className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-full flex items-center gap-1 shadow-2xs">
                          {[
                            { value: 'donations', title: 'Donasi' },
                            { value: 'expenditures', title: 'Belanja' },
                            { value: 'all', title: 'Semua' },
                          ].map((item) => {
                            const isActive = ledgerFilter === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => setLedgerFilter(item.value as any)}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 select-none cursor-pointer ${
                                  isActive
                                    ? 'bg-white border border-blue-600 text-slate-900 shadow-xs'
                                    : 'border border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {item.title}
                              </button>
                            );
                          })}
                        </div>
                        {isTreasurerAuthenticated && (
                          <button
                            type="button"
                            onClick={handleDownloadLedgerPDF}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-emerald-500/10 flex-1 md:flex-none whitespace-nowrap min-w-max"
                            title="Unduh Buku Mutasi Sebagai Laporan PDF Resmi"
                          >
                            <Download className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="whitespace-nowrap">Unduh PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto flex-1 scrollbar-thin">
                      <table className="w-full text-left min-w-[650px]">
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
                      <span className="text-xs font-bold text-slate-400 font-mono uppercase tracking-wider flex items-center justify-center gap-1.5">
                        <Lock className="h-3.5 w-3.5 text-slate-450 shrink-0" />
                        <span>INTEGRITAS DATA MUTASI AUDIT DENGAN TRANSAKSI FISIK TERVERIFIKASI</span>
                      </span>
                    </div>
                  </div>

                  {/* Secondary widgets grid under Ledger Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
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

                    {/* QR Code Donasi Publik Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-xs font-sans tracking-tight flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Barcode Donasi Publik</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans">
                          Pindai barcode QR dengan kamera HP Anda untuk langsung membuka gerbang pembayaran mandiri secara instan dan aman.
                        </p>
                      </div>

                      {/* QR Display */}
                      <div className="flex flex-col items-center justify-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 relative shadow-inner">
                        <div className="p-3.5 bg-white rounded-lg shadow-sm border border-slate-150">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                              window.location.origin + "/?pay=donation&amount=" + qrAmountPreset
                            )}`}
                            className="w-36 h-36 object-contain mix-blend-multiply" 
                            alt="QR Code Donasi Publik" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-500 mt-3 flex items-center gap-1 bg-white px-2.5 py-0.5 rounded-full shadow-xs border border-slate-100">
                          <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                          Rp {Number(qrAmountPreset).toLocaleString("id-ID")}
                        </span>
                      </div>

                      {/* Presets Grid */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Pilih Nominal Donasi</span>
                        <div className="grid grid-cols-3 gap-1.5 font-mono">
                          {[
                            { label: "20 Rb", value: "20000" },
                            { label: "50 Rb", value: "50000" },
                            { label: "100 Rb", value: "100000" },
                            { label: "250 Rb", value: "250000" },
                            { label: "500 Rb", value: "500000" },
                          ].map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setQrAmountPreset(preset.value)}
                              className={`text-[9px] font-bold py-1.5 px-1 rounded-lg border transition-all cursor-pointer ${
                                qrAmountPreset === preset.value
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const val = window.prompt("Masukkan nominal kustom (Rupiah):", qrAmountPreset);
                              if (val) {
                                const num = parseInt(val.replace(/\D/g, ""), 10);
                                if (!isNaN(num) && num > 0) {
                                  setQrAmountPreset(num.toString());
                                } else {
                                  alert("Harap masukkan nominal angka yang valid.");
                                }
                              }
                            }}
                            className={`text-[9px] font-bold py-1.5 px-1 rounded-lg border transition-all cursor-pointer font-sans ${
                              !["20000", "50000", "100000", "250000", "500000"].includes(qrAmountPreset)
                                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {!["20000", "50000", "100000", "250000", "500000"].includes(qrAmountPreset) ? (
                              <span className="flex items-center justify-center gap-0.5">
                                Kustom <Check className="h-2.5 w-2.5" />
                              </span>
                            ) : (
                              "Kustom..."
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Open Gateway Direct Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setPublicDonationAmount(qrAmountPreset);
                          setPublicDonorIsAnon(false);
                          setPublicDonorName("");
                          setPublicDonationMethod("Bank Transfer");
                          setPublicDonationProof("");
                          setPublicGatewayError("");
                          setPublicGatewaySuccess("");
                          setIsPublicGatewayOpen(true);
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xxs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs font-sans"
                      >
                        <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Kirim Donasi di Perangkat Ini</span>
                      </button>
                    </div>

                    {/* Linimasa Milestones Proyek Card */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 text-xs font-sans tracking-tight flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Linimasa Tahapan Proyek</span>
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
                                  <span className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full flex items-center justify-center border font-mono ${dotClass}`}>
                                    {isCompleted ? (
                                      <Check className="h-2.5 w-2.5 text-white" />
                                    ) : isOngoing ? (
                                      <ArrowRight className="h-2.5 w-2.5 text-white animate-pulse" />
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                    )}
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
                              <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">{new Date(log.timestamp).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })} WIB</p>
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
                        <p className="text-emerald-300 text-xs mt-1">Sesi Aktif: <span className="font-bold text-white">{currentUser?.name}</span> ({currentUser?.role === 'ADMIN' ? 'Admin' : 'Bendahara'})</p>
                      </div>

                      <button 
                        onClick={handleLogoutAction}
                        className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-850 text-white px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Logout / Keluar</span>
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
                                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                  {[
                                    { value: 'Bank Transfer', title: 'Transfer Bank (BCA/Mandiri/BSI)' },
                                    { value: 'E-Wallet', title: 'Dompet Digital (QRIS/LinkAja/Gopay)' },
                                    { value: 'Cash', title: 'Tunai / Secara Langsung' },
                                  ].map((item) => {
                                    const isChecked = donationMethod === item.value;
                                    return (
                                      <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xs text-slate-700 font-medium py-0.5">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => setDonationMethod(item.value)}
                                          className="accent-emerald-600 rounded h-4 w-4 cursor-pointer"
                                        />
                                        <span className="group-hover:text-emerald-700 transition-colors leading-normal">
                                          {item.title}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
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
                        <p className="text-slate-400 text-xs mt-1">Sesi Aktif: <span className="font-bold text-white">{currentUser?.name}</span> ({currentUser?.role === 'ADMIN' ? 'Admin' : 'Manajer Proyek'})</p>
                      </div>

                      <button 
                        onClick={handleLogoutAction}
                        className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
                      >
                        <LogOut className="h-3.5 w-3.5 text-rose-500" />
                        <span>Logout / Keluar</span>
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
                        <h3 className="font-bold text-slate-800 text-xs mb-1">Manajemen Tahapan & Sasaran Proyek</h3>
                        <p className="text-[10px] text-slate-400 leading-normal">Atur tenggat sasaran strategis konstruksi fisik proyek dan perbarui status pengerjaan secara real-time.</p>
                      </div>

                      {/* Form Tambah Milestone */}
                      <form onSubmit={handleCreateMilestone} className="border-t border-slate-100 pt-4 space-y-3 text-[10px]">
                        <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-2">Tambah Sasaran Baru</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-505 mb-1 font-semibold">Nama Sasaran / Tahapan Proyek *</label>
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
                            <div className="flex flex-col gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {[
                                { value: 'PENDING', title: 'Rencana / Pending' },
                                { value: 'ON_GOING', title: 'Sedang Berlangsung' },
                                { value: 'COMPLETED', title: 'Selesai (Completed)' },
                              ].map((item) => {
                                const isChecked = newMilestoneStatus === item.value;
                                return (
                                  <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xxs text-slate-700 font-medium leading-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => setNewMilestoneStatus(item.value as any)}
                                      className="accent-emerald-600 rounded h-3.5 w-3.5 cursor-pointer"
                                    />
                                    <span className="group-hover:text-emerald-700 transition-colors leading-normal">
                                      {item.title}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
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
                              .map((ms) => {
                                const isCompleted = ms.status === 'COMPLETED';
                                const isOngoing = ms.status === 'ON_GOING';
                                const isPending = ms.status === 'PENDING';

                                return (
                                  <div 
                                    key={ms.id} 
                                    className={`p-3 rounded-xl space-y-2 text-xxs border transition-all duration-300 ${
                                      isCompleted
                                        ? 'bg-cyan-50/20 border-cyan-200 border-l-4 border-l-cyan-500 shadow-2xs'
                                        : isOngoing
                                        ? 'bg-fuchsia-50/20 border-fuchsia-200 border-l-4 border-l-fuchsia-500 shadow-2xs'
                                        : 'bg-yellow-50/20 border-yellow-250 border-l-4 border-l-yellow-500 shadow-2xs'
                                    }`}
                                  >
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                      <div>
                                        <label className="block text-[8px] text-slate-400 font-bold uppercase mb-1.5">Status Pekerjaan</label>
                                        
                                        <div className="relative flex items-start justify-between w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                                          {/* Horizontal connected pipeline track */}
                                          <div className="absolute left-8 right-8 top-[19px] -translate-y-1/2 h-1 bg-slate-100 rounded-full pointer-events-none">
                                            <div 
                                              className={`h-full transition-all duration-300 rounded-full ${
                                                isCompleted 
                                                  ? 'bg-cyan-500' 
                                                  : isOngoing 
                                                  ? 'bg-fuchsia-500' 
                                                  : 'bg-yellow-500'
                                              }`}
                                              style={{
                                                width: isCompleted ? '100%' : isOngoing ? '50%' : '0%'
                                              }}
                                            />
                                          </div>

                                          {/* Option: PENDING */}
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateMilestoneStatus(ms.id, 'PENDING', ms.progressNotes, ms.title, ms.expectedDate, ms.category)}
                                            className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-hidden"
                                          >
                                            <div 
                                              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                                                isPending
                                                  ? 'bg-yellow-50 border-yellow-500 ring-4 ring-yellow-100/70'
                                                  : 'bg-white border-slate-300 group-hover:border-slate-500'
                                              }`}
                                            >
                                              <div className={`w-2 h-2 rounded-full transition-all duration-200 ${isPending ? 'bg-yellow-500' : 'bg-transparent'}`} />
                                            </div>
                                            <span className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${isPending ? 'text-yellow-600' : 'text-slate-400 group-hover:text-slate-650'}`}>
                                              Rencana
                                            </span>
                                          </button>

                                          {/* Option: ON_GOING */}
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateMilestoneStatus(ms.id, 'ON_GOING', ms.progressNotes, ms.title, ms.expectedDate, ms.category)}
                                            className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-hidden"
                                          >
                                            <div 
                                              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                                                isOngoing
                                                  ? 'bg-fuchsia-50 border-fuchsia-500 ring-4 ring-fuchsia-100/70'
                                                  : 'bg-white border-slate-300 group-hover:border-slate-500'
                                              }`}
                                            >
                                              <div className={`w-2 h-2 rounded-full transition-all duration-200 ${isOngoing ? 'bg-fuchsia-500' : 'bg-transparent'}`} />
                                            </div>
                                            <span className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${isOngoing ? 'text-fuchsia-600' : 'text-slate-400 group-hover:text-slate-650'}`}>
                                              Progres
                                            </span>
                                          </button>

                                          {/* Option: COMPLETED */}
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateMilestoneStatus(ms.id, 'COMPLETED', ms.progressNotes, ms.title, ms.expectedDate, ms.category)}
                                            className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-hidden"
                                          >
                                            <div 
                                              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                                                isCompleted
                                                  ? 'bg-cyan-50 border-cyan-500 ring-4 ring-cyan-100/70'
                                                  : 'bg-white border-slate-300 group-hover:border-slate-500'
                                              }`}
                                            >
                                              <div className={`w-2 h-2 rounded-full transition-all duration-200 ${isCompleted ? 'bg-cyan-500' : 'bg-transparent'}`} />
                                            </div>
                                            <span className={`text-[8px] font-bold uppercase mt-1 tracking-wider ${isCompleted ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-650'}`}>
                                              Selesai
                                            </span>
                                          </button>
                                        </div>
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
                              );
                            })
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



            {activeTab === "setting" && currentUser?.role === "ADMIN" && (
              <div className="space-y-6 max-w-6xl mx-auto md:pb-12">
                {/* Centralized Settings Dashboard Title Section */}
                <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl p-6 md:p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <span className="text-[10px] font-mono font-extrabold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1.5 w-max">
                        <Crown className="h-3 w-3 text-amber-500 shrink-0" />
                        KONSOL ADMIN
                      </span>
                      <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2 flex items-center gap-2">
                        <Cog className="h-6 w-6 text-amber-500 animate-spin-slow" />
                        Pusat Pengaturan & Setup Transparansi
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        Kelola seluruh konfigurasi utama sistem secara terpusat, mulai dari inisialisasi proyek, status publikasi, pengaturan nomor rekening donasi, hingga integrasi otomatis laporan ke Google Drive & Google Sheets secara real-time.
                      </p>
                    </div>
                    <span className="text-[10px] bg-white/5 border border-white/10 text-slate-300 font-mono font-bold px-3 py-2 rounded-lg self-start md:self-center">
                      SECURE BLUEPRINT v1.1
                    </span>
                  </div>
                </div>

                {/* CENTRALIZED SUB-NAVIGATION PILLS */}
                <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex flex-wrap items-center gap-1 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => setSettingSubTab("project")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                      settingSubTab === "project"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Inisialisasi Proyek Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingSubTab("rekening")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                      settingSubTab === "rekening"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Coins className="h-3.5 w-3.5" />
                    <span>Daftar Proyek & Rekening Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingSubTab("google")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                      settingSubTab === "google"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    <span>Integrasi Google Workspace</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingSubTab("keamanan")}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                      settingSubTab === "keamanan"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-650 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>Visibilitas & Pemulihan Basis Data</span>
                  </button>
                </div>

                {/* 1. ADVANCED DATA INTEGRITY CONTROL PANEL */}
                {settingSubTab === "keamanan" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  {/* VISIBILITY SETTINGS BOARD */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-100 pb-3">
                      <Eye className="h-4 w-4 text-emerald-600 font-bold" />
                      <h4 className="text-sm font-bold">Pengaturan Visibilitas Proyek</h4>
                    </div>
                    <p className="text-xxs text-slate-500 leading-relaxed">
                      Atur apakah sistem memperbolehkan beberapa proyek aktif berjalan secara bersamaan, atau membatasi pelacakan hanya ke satu proyek utama aktif saja di halaman publik.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-slate-700 block">Single Active Project</span>
                          <span className="text-[10px] text-slate-400 block">Hanya 1 proyek aktif ditampilkan kepada publik.</span>
                        </div>
                        <input
                          type="radio"
                          id="vis-single"
                          name="vis-mode"
                          checked={visibilityMode === "single"}
                          onChange={() => setVisibilityMode("single")}
                          className="h-4 w-4 text-emerald-650 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                        <div className="space-y-0.5">
                          <span className="text-xs font-semibold text-slate-700 block">Multiple Active Projects</span>
                          <span className="text-[10px] text-slate-400 block">Daftar dropdown proyek publik ditampilkan kepada pengunjung.</span>
                        </div>
                        <input
                          type="radio"
                          id="vis-multiple"
                          name="vis-mode"
                          checked={visibilityMode === "multiple"}
                          onChange={() => setVisibilityMode("multiple")}
                          className="h-4 w-4 text-emerald-650 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/visibility-settings", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${authToken}`
                              },
                              body: JSON.stringify({ visibilityMode })
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setFormSuccess(data.message || "Pengaturan visibilitas berhasil disimpan.");
                              fetchAllData();
                            } else {
                              setFormError(data.error || "Gagal memperbarui pengaturan visibilitas.");
                            }
                          } catch (err) {
                            console.error("Save visibility error:", err);
                            setFormError("Gagal terhubung dengan server.");
                          }
                        }}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xxs font-bold transition shadow-xs cursor-pointer"
                      >
                        Simpan Mode Visibilitas
                      </button>
                    </div>
                  </div>

                  {/* AUTO BACKUPS & RESTORE POINTS */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                    <div className="flex items-center space-x-2 text-slate-800 border-b border-slate-100 pb-3">
                      <Database className="h-4 w-4 text-amber-600 font-bold" />
                      <h4 className="text-sm font-bold">Titik Re-Inisiasi & Cadangan Otomatis</h4>
                    </div>
                    <p className="text-xxs text-slate-500 leading-relaxed">
                      Sistem melakukan <strong>auto backup basis data</strong> secara otomatis setiap kali admin menginisiasi proyek baru. Anda dapat memulihkan seluruh laporan keuangan ke titik restore di bawah.
                    </p>

                    <div className="space-y-2 max-h-[190px] overflow-y-auto scrollbar-thin pr-1">
                      {backupsList.length === 0 ? (
                        <div className="text-center py-8 text-neutral-400 text-xxs bg-neutral-50 rounded-xl border border-dashed border-neutral-200 italic">
                          Belum ada titik backup otomatis yang tercatat.
                        </div>
                      ) : (
                        backupsList.map((item: any) => (
                          <div key={item.id} className="border border-slate-100 bg-slate-50/50 hover:bg-slate-50 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xxs transition">
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <span className="font-semibold text-slate-700 truncate block">
                                Pre-Init: {item.prevProjectName}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Proyek Baru: {item.initializedProjectName}
                              </span>
                              <span className="text-[9px] text-slate-400 block font-mono">
                                {new Date(item.timestamp).toLocaleString("id-ID")} • Oleh: {item.createdBy}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={restoringId !== null}
                              onClick={async () => {
                                const confirmed = window.confirm(`PERINGATAN BAHAYA!\n\nApakah Anda sangat yakin ingin mengembalikan seluruh data transaksi keuangan basis data ke titik restore tanggal ${new Date(item.timestamp).toLocaleString("id-ID")} ini?\n\nSemua data transaksi setelah tanggal restore point akan digantikan secara penuh oleh isi cadangan.`);
                                if (!confirmed) return;
                                
                                setRestoringId(item.id);
                                try {
                                  const res = await fetch(`/api/backups/${item.id}/restore`, {
                                    method: "POST",
                                    headers: {
                                      "Authorization": `Bearer ${authToken}`
                                    }
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    setFormSuccess(data.message || "Basis data berhasil dikembalikan.");
                                    fetchAllData();
                                  } else {
                                    setFormError(data.error || "Gagal mengembalikan basis data.");
                                  }
                                } catch (err) {
                                  console.error("Restore backup error:", err);
                                  setFormError("Gagal berkomunikasi dengan server backup.");
                                } finally {
                                  setRestoringId(null);
                                }
                              }}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 whitespace-nowrap text-white text-[10px] font-bold rounded-lg transition shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {restoringId === item.id ? "Memulihkan..." : "Pulihkan"}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                )}

                {/* DAFTAR PROYEK SECTION */}
                {settingSubTab === "rekening" && (
                  <>
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Daftar Proyek Terdaftar (Admin)</h4>
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
                                    <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                      {[
                                        { value: 'baru', title: 'Proyek Baru' },
                                        { value: 'renovasi', title: 'Renovasi' },
                                        { value: 'alih_fungsi', title: 'Alih Fungsi' },
                                      ].map((item) => {
                                        const isChecked = editProjType === item.value;
                                        return (
                                          <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xxs text-slate-750 font-medium leading-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => setEditProjType(item.value as any)}
                                              className="accent-amber-500 rounded h-3.5 w-3.5 cursor-pointer"
                                            />
                                            <span className="group-hover:text-amber-655 transition-colors leading-normal">
                                              {item.title}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
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
                                    <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                      {[
                                        { value: 'public', title: 'Publik (Terbuka)' },
                                        { value: 'private', title: 'Privat (Internal)' },
                                      ].map((item) => {
                                        const isChecked = editProjStatus === item.value;
                                        return (
                                          <label key={item.value} className="flex items-center gap-1.5 cursor-pointer select-none group text-xxs text-slate-755 font-medium leading-none">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => setEditProjStatus(item.value)}
                                              className="accent-amber-500 rounded h-3.5 w-3.5 cursor-pointer"
                                            />
                                            <span className="group-hover:text-amber-655 transition-colors leading-normal">
                                              {item.title}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
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
                                      Inisiator: <span className="font-bold text-slate-600">{p.initializedBy || "Admin"}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex sm:flex-col gap-2 shrink-0 sm:self-center">
                                  {summary?.projectConfig?.id !== p.id && (
                                    <button
                                      type="button"
                                      onClick={() => handleActivateProject(p.id)}
                                      className="flex-1 sm:flex-none py-1.5 px-3 border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg hover:bg-emerald-100 transition text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                      Aktifkan & Lihat Proyek
                                    </button>
                                  )}
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

                {/* 💳 PENGATURAN REKENING BANK PENDANAAN (ADMIN SETUP) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full border-b border-l border-slate-100 flex items-center justify-center pointer-events-none">
                    <Coins className="h-6 w-6 text-slate-300" />
                  </div>

                  <div className="border-b border-slate-100 pb-4 pr-12">
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md uppercase tracking-wider font-mono">
                      MODUL UTAMA KEUANGAN
                    </span>
                    <h4 className="text-base font-bold text-slate-900 mt-2 flex items-center gap-2">
                       Pengaturan Rekening Bank Pendanaan (Tujuan Donasi)
                    </h4>
                    <p className="text-xxs text-slate-500 mt-1 leading-relaxed">
                      Konfigurasikan seluruh rekening bank resmi, e-wallet, atau wallet address cryptocurrency yang akan ditampilkan di portal donasi publik kami. Admin dapat menambahkan rekening, merubah status keaktifan, mengunggah QRIS, atau melakukan revitalisasi data donasi.
                    </p>
                  </div>

                  {/* Split Layout: List of bank accounts & form */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT PANEL: LIST OF CONFIGURED ACCOUNTS (7/12) */}
                    <div className="lg:col-span-7 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Rekening Terdaftar ({bankAccounts.length || 0})
                        </span>
                        {editingBankAccountId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBankAccountId(null);
                              setBankNameForm("");
                              setBankNumberForm("");
                              setBankHolderForm("");
                              setBankQrUrlForm("");
                              setBankIsActiveForm(true);
                            }}
                            className="text-xxs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-100 cursor-pointer"
                          >
                            Batal Edit
                          </button>
                        )}
                      </div>

                      <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                        {bankAccounts.length === 0 ? (
                          <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50 text-slate-450 space-y-2">
                            <Coins className="h-8 w-8 mx-auto text-slate-350" />
                            <p className="text-xxs italic">Belum ada rekening bank yang disiapkan di database.</p>
                          </div>
                        ) : (
                          bankAccounts.map((account) => {
                            const isBeingEdited = editingBankAccountId === account.id;
                            return (
                              <div 
                                key={account.id} 
                                className={`border rounded-xl p-4 transition-all duration-200 relative overflow-hidden group ${
                                  isBeingEdited 
                                    ? "bg-amber-50/40 border-amber-400 border-2" 
                                    : account.isActive 
                                      ? "bg-white border-slate-200 hover:border-slate-350" 
                                      : "bg-slate-50/55 border-slate-200 opacity-60 hover:opacity-100"
                                }`}
                              >
                                {isBeingEdited && (
                                  <div className="absolute top-0 right-0 bg-amber-500 text-white font-mono text-[8px] font-bold px-2.5 py-0.5 rounded-bl">
                                    SEDANG DIEDIT
                                  </div>
                                )}

                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded tracking-wide uppercase font-sans ${
                                        account.bankName.toUpperCase().includes("BCA") 
                                          ? "bg-blue-650 text-white" 
                                          : account.bankName.toUpperCase().includes("MANDIRI") 
                                            ? "bg-teal-600 text-white" 
                                            : account.bankName.toUpperCase().includes("USDT") || account.bankName.toUpperCase().includes("CRYPTO")
                                              ? "bg-amber-500 text-white" 
                                              : "bg-emerald-600 text-white"
                                      }`}>
                                        {account.bankName}
                                      </span>
                                      
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                        account.isActive 
                                          ? "bg-emerald-50 text-emerald-850 border border-emerald-100" 
                                          : "bg-slate-100 text-slate-500 border border-slate-200"
                                      }`}>
                                        {account.isActive ? "● AKTIF" : "○ NONAKTIF"}
                                      </span>
                                    </div>

                                    <div>
                                      <p className="text-[10px] text-slate-450 uppercase tracking-wide font-sans">Nama Pemilik Akun / Holder</p>
                                      <h5 className="text-xs font-bold text-slate-800 font-sans">{account.accountHolder}</h5>
                                    </div>

                                    <div>
                                      <p className="text-[10px] text-slate-450 uppercase tracking-wide font-sans">Nomor Rekening / Wallet Address</p>
                                      <p className="text-xs font-semibold font-mono text-slate-800">{account.accountNumber}</p>
                                    </div>

                                    {account.qrCodeUrl && (
                                      <div className="pt-1.5 flex items-center gap-2">
                                        <QrCode className="h-4 w-4 text-slate-400" />
                                        <button
                                          type="button"
                                          onClick={() => setSelectedReceiptUrl(account.qrCodeUrl || "")}
                                          className="text-xxs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 cursor-pointer flex items-center gap-1"
                                        >
                                          🔍 Lihat Barcode QRIS
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Right side controls per account */}
                                  <div className="flex flex-col gap-1.5 self-center">
                                    <button
                                      type="button"
                                      onClick={() => handleEditBankAccount(account)}
                                      className="py-1 px-2.5 border border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700 rounded text-[10px] font-bold transition cursor-pointer hover:bg-slate-100"
                                    >
                                      Edit Info
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteBankAccount(account.id)}
                                      className="py-1 px-2.5 border border-red-200 bg-red-50 text-red-750 rounded text-[10px] font-bold transition hover:bg-red-100 cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: FORM TO CREATE / EDIT ACCOUNTS WITH INTERACTIVE VISUAL PREVIEW */}
                    <div className="lg:col-span-5 space-y-5">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                        <div className="border-b border-slate-200 pb-2">
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans flex items-center gap-1.5">
                            {editingBankAccountId ? (
                              <>
                                <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                                <span>Edit Rekening Terpilih</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span>Daftarkan Rekening Baru</span>
                              </>
                            )}
                          </h5>
                          <p className="text-[10px] text-slate-400">Lengkapi formulir identifikasi rekening.</p>
                        </div>

                        <form onSubmit={handleSaveBankAccount} className="space-y-4 text-xs">
                          {/* Nama Bank */}
                          <div className="flex flex-col space-y-1">
                            <label className="text-slate-650 font-bold">Nama Bank / Jenis Saluran *</label>
                            <input 
                              type="text"
                              value={bankNameForm}
                              onChange={(e) => setBankNameForm(e.target.value)}
                              placeholder="Misal: BCA, MANDIRI, QRIS, USDT"
                              required
                              className="w-full bg-white border border-slate-250 px-3 py-1.5 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold uppercase"
                            />
                            {/* Quick recommendation tags */}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {["BCA", "MANDIRI", "BNI", "BRI", "QRIS", "USDT"].map((tag) => (
                                <button
                                  type="button"
                                  key={tag}
                                  onClick={() => setBankNameForm(tag)}
                                  className="text-[9px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-mono px-2 py-0.5 rounded transition cursor-pointer"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Nomor Rekening */}
                          <div className="flex flex-col space-y-1">
                            <label className="text-slate-650 font-bold">Nomor Rekening / ID Wallet *</label>
                            <input 
                              type="text"
                              value={bankNumberForm}
                              onChange={(e) => setBankNumberForm(e.target.value)}
                              placeholder="Ketik tanpa strip atau spasi..."
                              required
                              className="w-full bg-white border border-slate-250 px-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                            />
                          </div>

                          {/* Pemilik Rekening */}
                          <div className="flex flex-col space-y-1">
                            <label className="text-slate-650 font-bold">Nama Atas Nama Pemilik *</label>
                            <input 
                              type="text"
                              value={bankHolderForm}
                              onChange={(e) => setBankHolderForm(e.target.value)}
                              placeholder="Misal: BENDAHARA MASJID RAYA"
                              required
                              className="w-full bg-white border border-slate-250 px-3 py-1.5 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-amber-500 uppercase font-medium"
                            />
                          </div>

                          {/* QR Code Uploader */}
                          <div className="space-y-1">
                            <ImageUploader
                              label="Upload QRIS Pembayaran (Opsional, format Image)"
                              value={bankQrUrlForm}
                              onChange={setBankQrUrlForm}
                              required={false}
                            />
                          </div>

                          {/* Keaktifan */}
                          <div className="flex items-center space-x-2 pt-1">
                            <input 
                              type="checkbox"
                              id="bankIsActive"
                              checked={bankIsActiveForm}
                              onChange={(e) => setBankIsActiveForm(e.target.checked)}
                              className="rounded text-amber-600 focus:ring-amber-550 w-4 h-4 cursor-pointer"
                            />
                            <label htmlFor="bankIsActive" className="text-xxs text-slate-700 font-semibold font-sans cursor-pointer select-none">
                              Tampilkan rekening langsung ke pintu donatur
                            </label>
                          </div>

                          {/* Form Control Buttons */}
                          <div className="flex gap-2 pt-2 border-t border-slate-200">
                            {editingBankAccountId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBankAccountId(null);
                                  setBankNameForm("");
                                  setBankNumberForm("");
                                  setBankHolderForm("");
                                  setBankQrUrlForm("");
                                  setBankIsActiveForm(true);
                                }}
                                className="w-1/3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition text-center cursor-pointer"
                              >
                                Batal
                              </button>
                            )}
                            <button
                              type="submit"
                              className={`py-2 font-bold text-[10px] rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer text-white shadow-xs ${
                                editingBankAccountId 
                                  ? "w-2/3 bg-amber-650 hover:bg-amber-600" 
                                  : "w-full bg-emerald-600 hover:bg-emerald-555"
                              }`}
                            >
                              <Check className="h-3 w-3" />
                              <span>{editingBankAccountId ? "Simpan Perubahan" : "Pasang Rekening Baru"}</span>
                            </button>
                          </div>

                        </form>
                      </div>

                      {/* 💳 INTERACTIVE SMART CARD PREVIEW */}
                      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-850 shadow-md relative overflow-hidden space-y-4">
                        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-blue-600/15 rounded-full blur-xl pointer-events-none"></div>

                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block font-sans">Official Channel Card</span>
                            <span className="text-xs font-black tracking-wide uppercase font-mono bg-white/10 px-2 py-0.5 rounded">
                              {bankNameForm ? bankNameForm : "BANK NAMA"}
                            </span>
                          </div>
                          <div className="h-6 w-8 bg-slate-800 rounded-md border border-slate-700 flex items-center justify-center font-bold text-[8px] font-mono tracking-tight text-slate-300">
                            PORTAL
                          </div>
                        </div>

                        <div className="pt-2">
                          <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-wider block font-sans mb-1">No. Rekening / Wallet</span>
                          <p className="text-xs font-mono font-bold tracking-widest text-white leading-none">
                            {bankNumberForm ? bankNumberForm : "•••• •••• •••• ••••"}
                          </p>
                        </div>

                        <div className="flex justify-between items-end pt-2 border-t border-white/5">
                          <div className="space-y-0.5">
                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block font-sans">Account Holder</span>
                            <p className="text-[10px] font-bold uppercase font-sans tracking-wide truncate max-w-[190px]">
                              {bankHolderForm ? bankHolderForm : "Atas Nama Penerima"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold block leading-none">
                              {bankIsActiveForm ? "ACTIVE" : "DISABLED"}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              </>
            )}

                {settingSubTab === "project" && (
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
                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {[
                            { value: 'baru', title: 'Proyek Baru (Infrastruktur Total)' },
                            { value: 'renovasi', title: 'Renovasi / Pemugaran Bangunan' },
                            { value: 'alih_fungsi', title: 'Alih Fungsi / Relokasi Lahan' },
                          ].map((item) => {
                            const isChecked = newProjType === item.value;
                            return (
                              <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xs text-slate-700 leading-tight">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => setNewProjType(item.value)}
                                  className="accent-amber-500 rounded h-4 w-4 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                                  {item.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
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
                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
                          {[
                            { value: 'public', title: 'Publik (Akses Terbuka & Transparan Penuh)' },
                            { value: 'private', title: 'Privat (Internal Terbatas)' },
                          ].map((item) => {
                            const isChecked = newProjStatus === item.value;
                            return (
                              <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xs text-slate-700 leading-tight">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => setNewProjStatus(item.value)}
                                  className="accent-amber-500 rounded h-4 w-4 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-800 group-hover:text-amber-600 transition-colors">
                                  {item.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
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

                  {/* 4. Danger Zone / Strategy Resets */}
                  <div className={`transition-all duration-300 p-4 rounded-xl border ${newProjStartFresh ? 'border-red-300 bg-red-50/60 shadow-sm shadow-red-150/20' : 'border-rose-100 bg-rose-50/20'} space-y-3`}>
                    <div className="flex items-center space-x-2 pb-1 border-b border-rose-100/50">
                      <ShieldAlert className={`h-4 w-4 ${newProjStartFresh ? 'text-red-600 animate-bounce' : 'text-rose-500'}`} />
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-700">Zona Bahaya / Danger Zone</span>
                      {newProjStartFresh && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-red-600 text-white animate-pulse">
                          PENGHAPUSAN AKTIF
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          id="startFresh"
                          checked={newProjStartFresh}
                          onChange={(e) => {
                            setNewProjStartFresh(e.target.checked);
                            if (!e.target.checked) setStartFreshConfirmText("");
                          }}
                          className="mt-1 rounded text-red-600 focus:ring-red-500 cursor-pointer h-4 w-4"
                        />
                      </div>
                      <label htmlFor="startFresh" className="text-xxs text-slate-700 leading-relaxed select-none cursor-pointer">
                        <span className={`block font-bold transition-all duration-200 ${newProjStartFresh ? 'text-red-700 text-xs' : 'text-slate-800'}`}>
                          Mulai Bersih (Sterilkan Seluruh Database)
                        </span>
                        Sapu bersih semua histori donasi eksperimental, log progress aktivitas kontraktor, dan tabel rincian transaksi belanja kas terdahulu agar sistem benar-benar kosong.
                      </label>
                    </div>

                    <AnimatePresence>
                      {newProjStartFresh && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-3 bg-red-600 text-white rounded-lg text-xxs font-medium leading-normal space-y-1.5 shadow-md">
                            <div className="flex items-center space-x-1.5 font-bold text-[11px] uppercase tracking-wide">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                              <span>Peringatan Destruktif Keras!</span>
                            </div>
                            <p className="opacity-95 text-[10px]">
                              Mengaktifkan fitur ini berarti Anda akan <strong>MENGHAPUS PERMANEN</strong> seluruh donasi publik, rancangan anggaran biaya (RAB) serta realisasi belanja operasional instansi milik <strong>semua proyek-proyek terdahulu</strong> di database global. 
                            </p>
                            <p className="text-[9.5px] font-bold border-t border-red-500 pt-1.5 mt-1 bg-red-700/40 p-1.5 rounded text-amber-100 flex items-center gap-1.5">
                              <Lightbulb className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                              <span>REKOMENDASI PARALEL: Kosongkan centang ini jika Anda ingin proyek baru ini berjalan berdampingan tanpa menghapus data sejarah keuangan dari proyek lama!</span>
                            </p>

                            {/* Text typing verification for safety */}
                            <div className="mt-3 p-3 bg-red-950/40 rounded-lg border border-red-500/20 space-y-2 text-white">
                              <label className="block text-[9.5px] font-extrabold uppercase text-amber-300 flex items-center gap-1.5">
                                <AlertTriangle className="h-3 w-3 text-amber-300 shrink-0" />
                                <span>TULIS FRASA KONFIRMASI PEMPROSESAN:</span>
                              </label>
                              <p className="text-[9.5px] text-red-100 leading-relaxed opacity-90">
                                Untuk membuka kunci pengoperasian instruksi hapus ini, silakan ketik kata kunci <strong className="text-amber-300 font-mono select-all bg-red-900/50 px-1 py-0.5 rounded">STERILKAN DATABASE</strong> di bawah ini:
                              </p>
                              <input
                                type="text"
                                value={startFreshConfirmText}
                                onChange={(e) => setStartFreshConfirmText(e.target.value)}
                                placeholder="Ketik 'STERILKAN DATABASE'"
                                className="w-full bg-red-900/40 border border-red-500/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-red-300/60 focus:outline-none focus:ring-1 focus:ring-red-400 font-sans tracking-wide"
                              />
                              {startFreshConfirmText === "STERILKAN DATABASE" ? (
                                <p className="text-[9px] text-emerald-350 font-bold flex items-center space-x-1">
                                  <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                  <span>Kata kunci cocok. Kunci pengaman dibuka.</span>
                                </p>
                              ) : startFreshConfirmText.length > 0 ? (
                                <p className="text-[9px] text-amber-300 font-semibold flex items-center space-x-1 animate-pulse">
                                  <AlertCircle className="h-3 w-3 text-amber-300 shrink-0" />
                                  <span>Kata kunci belum sesuai...</span>
                                </p>
                              ) : null}
                            </div>

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Error / Success Feedback */}
                  {formError && (
                    <div className="bg-red-55 p-3 rounded-lg text-red-750 text-xs font-semibold border border-red-200 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {formSuccess && (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 px-4 py-3 rounded-lg text-xs font-medium flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{formSuccess}</span>
                    </div>
                  )}

                  {/* Actions Submit */}
                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      disabled={projConfigLoading || (newProjStartFresh && startFreshConfirmText !== "STERILKAN DATABASE")}
                      className={`w-full sm:w-auto px-8 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer ${
                        newProjStartFresh
                          ? startFreshConfirmText === "STERILKAN DATABASE"
                            ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          : "bg-amber-600 hover:bg-amber-500 text-white"
                      }`}
                    >
                      {projConfigLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{newProjStartFresh ? "Menghapus & Menginisialisasi..." : "Membuat Proyek Baru..."}</span>
                        </>
                      ) : (
                        <>
                          {newProjStartFresh ? (
                            <>
                              <ShieldAlert className="h-4 w-4" />
                              <span>{startFreshConfirmText === "STERILKAN DATABASE" ? "HAPUS PERMANEN & INISIALISASI BARU" : "Pembersihan Terkunci"}</span>
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              <span>Inisialisasi & Luncurkan Portal Proyek</span>
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

              {/* 3. GOOGLE WORKSPACE INTEGRATION SUB-TAB */}
              {settingSubTab === "google" && (
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

              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-100 text-xxs font-mono text-emerald-800 flex items-center justify-center gap-1.5 font-bold">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-650 shrink-0" />
                <span>STATUS VERIFIKASI: BUKTI TRANSAKSI DI BUKU KAS VALID & SAH</span>
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
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
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

      {/* PUBLIC DONATION PAYMENT GATEWAY MODAL */}
      <AnimatePresence>
        {isPublicGatewayOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
            onClick={() => {
              if (!publicGatewaySubmitting) setIsPublicGatewayOpen(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden space-y-4 my-8"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-emerald-600" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Gerbang Kontribusi Donasi Mandiri</h4>
                    <p className="text-[10px] text-slate-400">Pernyataan komitmen pelacakan dana pembangunan transparan 100%</p>
                  </div>
                </div>
                {!publicGatewaySubmitting && (
                  <button 
                    onClick={() => setIsPublicGatewayOpen(false)}
                    className="bg-slate-100 text-slate-500 hover:text-slate-900 p-1 rounded-full text-xs font-bold w-6 h-6 flex items-center justify-center transition cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Success / Error Banners */}
              {publicGatewaySuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-4 rounded-xl border border-emerald-150 flex items-start space-x-2 animate-fade-in">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Konfirmasi Diterima!</p>
                    <p className="text-[11px] leading-relaxed">{publicGatewaySuccess}</p>
                  </div>
                </div>
              )}

              {publicGatewayError && (
                <div className="bg-rose-50 text-rose-700 text-xs p-4 rounded-xl border border-rose-150 flex items-start space-x-2 animate-fade-in">
                  <span className="text-sm">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  </span>
                  <div className="space-y-1">
                    <p className="font-bold">Verifikasi Gagal</p>
                    <p className="text-[11px] leading-relaxed">{publicGatewayError}</p>
                  </div>
                </div>
              )}

              {/* Main Content & Payment Instructions */}
              {!publicGatewaySuccess && (
                <form onSubmit={handlePublicDonationSubmit} className="space-y-4 text-xs font-sans">
                  
                  {/* Payment Portals Info Section */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Panduan Transfer Tujuan Resmi (Daftar Terverifikasi)</span>
                    
                    {publicDonationMethod === "Bank Transfer" ? (
                      <div className="space-y-2">
                        {bankAccounts
                          .filter(acc => acc.isActive && !["QRIS", "GOPAY", "OVO", "DANA", "USDT", "CRYPTO"].some(k => acc.bankName.toUpperCase().includes(k)))
                          .map((acc) => (
                            <div key={acc.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-150 shadow-xs">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                  <span className="bg-blue-600 text-white font-extrabold px-1 rounded text-[8px] tracking-wider uppercase font-sans">
                                    {acc.bankName}
                                  </span> 
                                  {acc.accountHolder}
                                </span>
                                <p className="text-xxs font-mono font-semibold text-slate-500">No. Rekening: {acc.accountNumber}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(acc.accountNumber);
                                  alert(`Nomor rekening ${acc.bankName} berhasil disalin!`);
                                }}
                                className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded text-[10px] font-bold transition font-sans cursor-pointer whitespace-nowrap text-xxs"
                              >
                                Salin
                              </button>
                            </div>
                          ))}
                        {bankAccounts.filter(acc => acc.isActive && !["QRIS", "GOPAY", "OVO", "DANA", "USDT", "CRYPTO"].some(k => acc.bankName.toUpperCase().includes(k))).length === 0 && (
                          <div className="text-slate-400 py-1 text-center font-sans text-[11px] italic">
                            Belum ada tujuan transfer bank aktif yang disediakan saat ini.
                          </div>
                        )}
                      </div>
                    ) : publicDonationMethod === "E-Wallet" ? (
                      <div className="flex flex-col items-center justify-center bg-white p-3.5 rounded-lg border border-slate-150 shadow-xs space-y-2">
                        {bankAccounts
                          .filter(acc => acc.isActive && (acc.qrCodeUrl || ["QRIS", "GOPAY", "OVO", "DANA"].some(k => acc.bankName.toUpperCase().includes(k))))
                          .map((acc) => (
                            <div key={acc.id} className="w-full flex flex-col items-center justify-center space-y-2 py-2 border-b last:border-b-0 border-slate-100 pb-2">
                              <img 
                                src={acc.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=qris-resmi-${acc.accountNumber}`} 
                                alt={`QRIS ${acc.bankName} Resmi`}
                                className="w-28 h-28 object-contain border border-slate-100 rounded p-1 p-0.5" 
                                referrerPolicy="no-referrer"
                              />
                              <span className="text-[9px] font-sans font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100 uppercase mt-1">
                                {acc.bankName} STANDAR NASIONAL
                              </span>
                              <p className="text-slate-800 text-[10px] font-bold text-center">a/n {acc.accountHolder}</p>
                              <p className="text-slate-450 text-[9.5px] text-center max-w-xs">Pindai atau simpan QRIS di atas untuk dipindai menggunakan aplikasi keuangan dompet digital Anda.</p>
                            </div>
                          ))}
                        {bankAccounts.filter(acc => acc.isActive && (acc.qrCodeUrl || ["QRIS", "GOPAY", "OVO", "DANA"].some(k => acc.bankName.toUpperCase().includes(k)))).length === 0 && (
                          <div className="w-full flex flex-col items-center justify-center py-4 text-center">
                            <img 
                              src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=qris-panitia-pembangunan-masjid-terpercaya" 
                              alt="Mock QRIS Resmi"
                              className="w-24 h-24 object-contain mix-blend-multiply opacity-60" 
                              referrerPolicy="no-referrer"
                            />
                            <p className="text-slate-450 py-1 text-center font-sans text-[11px] italic mt-1 font-medium">
                              Belum ada QRIS/E-Wallet aktif di dalam database.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : publicDonationMethod === "Crypto" ? (
                      <div className="space-y-2">
                        {bankAccounts
                          .filter(acc => acc.isActive && ["USDT", "CRYPTO", "ETH", "BTC"].some(k => acc.bankName.toUpperCase().includes(k)))
                          .map((acc) => (
                            <div key={acc.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-150 shadow-xs">
                              <div className="space-y-1 max-w-[80%]">
                                <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                                  <span className="bg-amber-500 text-white font-extrabold px-1 rounded text-[8px] tracking-wider uppercase font-sans">
                                    {acc.bankName}
                                  </span> 
                                  {acc.accountHolder}
                                </span>
                                <p className="text-[9px] font-mono break-all text-slate-500">{acc.accountNumber}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(acc.accountNumber);
                                  alert(`Alamat wallet ${acc.bankName} berhasil disalin!`);
                                }}
                                className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded text-[10px] font-bold transition font-sans cursor-pointer whitespace-nowrap text-xxs"
                              >
                                Salin
                              </button>
                            </div>
                          ))}
                        {bankAccounts.filter(acc => acc.isActive && ["USDT", "CRYPTO", "ETH", "BTC"].some(k => acc.bankName.toUpperCase().includes(k))).length === 0 && (
                          <p className="text-slate-450 py-1 text-center font-sans text-[11px] italic">
                            Belum ada alamat dompet cryptocurrency yang disediakan saat ini.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-xs text-slate-500 text-xxs leading-relaxed">
                        {summary?.projectConfig?.name ? (
                          `Serahkan donasi langsung dalam tunai ke Kantor Yayasan Sekretariat / Kotak Amal Utama Masjid untuk proyek ${summary.projectConfig.name}. Tetap unggah foto slip penyerimaan resmi di kolom berikut.`
                        ) : (
                          `Serahkan donasi langsung dalam tunai ke Kantor Yayasan Sekretariat / Kotak Amal Utama Masjid Pembangunan Utama. Tetap unggah foto slip penyerimaan resmi di kolom berikut.`
                        )}
                      </div>
                    )}
                  </div>

                  {/* Form Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Donor Name */}
                    <div className="flex flex-col space-y-1">
                      <label className="text-slate-600 font-bold font-sans">Nama Donatur / Pengirim *</label>
                      <input 
                        type="text"
                        placeholder="Masukkan nama lengkap Anda..."
                        value={publicDonorName}
                        onChange={(e) => setPublicDonorName(e.target.value)}
                        disabled={publicDonorIsAnon}
                        required={!publicDonorIsAnon}
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs focus:ring-1 focus:ring-emerald-600 focus:bg-white focus:outline-none disabled:opacity-40 transition font-sans"
                      />
                      <div className="flex items-center space-x-1.5 pt-1">
                        <input 
                          type="checkbox"
                          id="publicAnon"
                          checked={publicDonorIsAnon}
                          onChange={(e) => setPublicDonorIsAnon(e.target.checked)}
                          className="rounded text-emerald-600 border-slate-300 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="publicAnon" className="text-xxs text-slate-500 select-none cursor-pointer">Sembunyikan nama (Hamba Allah)</label>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="flex flex-col space-y-1">
                      <label className="text-slate-600 font-bold font-sans">Nominal Donasi (Rupiah) *</label>
                      <input 
                        type="number"
                        placeholder="Contoh: 150000"
                        value={publicDonationAmount}
                        onChange={(e) => setPublicDonationAmount(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs focus:ring-1 focus:ring-emerald-600 focus:bg-white focus:outline-none transition font-mono text-slate-800 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Method Dropdown */}
                    <div className="flex flex-col space-y-1">
                      <label className="text-slate-600 font-bold font-sans">Pilihan Saluran Transfer *</label>
                      <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {[
                          { value: 'Bank Transfer', title: 'Transfer Bank (BCA / Mandiri / BSI)' },
                          { value: 'E-Wallet', title: 'QRIS / Dompet Digital (Gopay / OVO / Dana)' },
                          { value: 'Cash', title: 'Tunai / Secara Langsung' },
                        ].map((item) => {
                          const isChecked = publicDonationMethod === item.value;
                          return (
                            <label key={item.value} className="flex items-center gap-2 cursor-pointer select-none group text-xs text-slate-700 font-medium py-0.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => setPublicDonationMethod(item.value)}
                                className="accent-emerald-600 rounded h-4 w-4 cursor-pointer"
                              />
                              <span className="group-hover:text-emerald-700 transition-colors leading-normal">
                                {item.title}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Image Verification Proof */}
                    <div className="flex flex-col">
                      <ImageUploader 
                        label="Unggah Tangkapan Layar Resi Transfer *"
                        value={publicDonationProof}
                        onChange={setPublicDonationProof}
                        required={true}
                      />
                    </div>
                  </div>

                  {/* Submit buttons */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={publicGatewaySubmitting}
                      onClick={() => setIsPublicGatewayOpen(false)}
                      className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-lg transition text-xxs font-sans cursor-pointer disabled:opacity-55"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={publicGatewaySubmitting}
                      className="w-2/3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg transition-all text-xxs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-55 font-sans"
                    >
                      {publicGatewaySubmitting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Mengirim Laporan...</span>
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Kirim Laporan Konfirmasi</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESTRUCTIVE CONFIRMATION MODAL (DANGER ZONE) */}
      <AnimatePresence>
        {showStartFreshModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-950/75 backdrop-blur-md flex items-center justify-center p-4 z-55"
            onClick={() => setShowStartFreshModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border-4 border-red-600 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-5"
            >
              {/* Header */}
              <div className="flex items-center space-x-3 text-red-600 border-b border-red-100 pb-4">
                <div className="p-2 bg-red-100 rounded-2xl">
                  <ShieldAlert className="h-7 w-7 text-red-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">Dua Langkah Konfirmasi Akut!</h3>
                  <p className="text-[10px] text-red-600 uppercase tracking-widest font-bold">Langkah ini Tidak Dapat Dibatalkan</p>
                </div>
              </div>

              {/* Warning Content */}
              <div className="space-y-3.5">
                <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-slate-755 text-xxs sm:text-xs leading-relaxed space-y-2">
                  <p className="font-semibold text-red-800 text-xs flex items-center space-x-1.5 flex-wrap">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>Perhatian kepada Administrator Utama:</span>
                  </p>
                  <p className="text-slate-700">
                    Anda sedang menginisialisasi proyek baru dengan mengaktifkan mode <strong className="text-red-700">Mulai Bersih (Sterilkan Seluruh Database)</strong>. Tindakan ini akan mengosongkan riwayat secara menyeluruh:
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-medium pl-1 text-slate-800">
                    <li>Semua catatan donasi publik eksperimental</li>
                    <li>Semua log progress pembangunan digital fisikal</li>
                    <li>Rincian transaksi kas masuk & keluar terdahulu</li>
                    <li>Rencana Anggaran Biaya (RAB) dari seluruh proyek-proyek di database</li>
                  </ul>
                  <p className="text-[10.5px] font-bold text-red-700 bg-red-100/50 p-2 rounded flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
                    <span>data yang tertulis di server global saat ini akan lenyap selamanya dan tidak dapat dikembalikan dengan cara apapun.</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStartFreshModal(false)}
                  className="w-full sm:w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
                >
                  Batal, Amankan Data
                </button>
                <button
                  type="button"
                  disabled={projConfigLoading}
                  onClick={executeProjectInitialization}
                  className="w-full sm:w-1/2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md hover:shadow-red-200 disabled:opacity-50"
                >
                  {projConfigLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Ya, Hapus Permanen & Mulai</span>
                    </>
                  )}
                </button>
              </div>

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
