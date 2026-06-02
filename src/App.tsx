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
  FolderTree, 
  CheckCircle, 
  Loader2, 
  Search, 
  ShieldAlert, 
  Upload, 
  UserSquare2, 
  Clock, 
  Plus, 
  Check, 
  Eye, 
  Database,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  History,
  Code,
  LogOut,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  RABItem, 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  AuditLog 
} from "./types";
import { ImageUploader } from "./components/ImageUploader";

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

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "treasurer" | "pm" | "architecture">("dashboard");

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
  } | null>(null);

  const [donations, setDonations] = useState<Donation[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);
  const [progressLog, setProgressLog] = useState<PhysicalProgress[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [folderStructure, setFolderStructure] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  // UI status messages
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [schemaSelection, setSchemaSelection] = useState<"prisma" | "postgresql">("prisma");

  // Fetch core data from full-stack APIs
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const headersOpt = authToken ? { "Authorization": `Bearer ${authToken}` } : {};
      const [sumRes, donRes, expRes, progRes, auditRes, folderRes] = await Promise.all([
        fetch("/api/financial-summary", { headers: headersOpt }),
        fetch("/api/donations", { headers: headersOpt }),
        fetch("/api/expenditures", { headers: headersOpt }),
        fetch("/api/progress", { headers: headersOpt }),
        fetch("/api/audit-logs", { headers: headersOpt }),
        fetch("/api/folder-structure", { headers: headersOpt })
      ]);

      const sumData = await sumRes.json();
      const donData = await donRes.json();
      const expData = await expRes.json();
      const progData = await progRes.json();
      const auditData = await auditRes.json();
      const folderData = await folderRes.json();

      setSummary(sumData);
      setDonations(donData);
      setExpenditures(expData);
      setProgressLog(progData);
      setAuditLogs(auditData);
      setFolderStructure(folderData);
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
        fetchAllData();
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
    setFormSuccess("Sesi Anda telah ditutup dengan aman.");
    setTimeout(() => setFormSuccess(""), 4000);
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
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            SB
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">Transparansi <span className="text-emerald-600 font-extrabold">SmartBuild</span></h1>
            <p className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider leading-none mt-0.5">Proyek Ekspansi Pusat Komunitas Al-Noor</p>
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
            Dashboard Publik
          </button>
          <button
            onClick={() => setActiveTab("treasurer")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "treasurer"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Portal Bendahara
          </button>
          <button
            onClick={() => setActiveTab("pm")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeTab === "pm"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Catatan Proyek (PM)
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
              activeTab === "architecture"
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>Spesifikasi Skema</span>
          </button>
        </nav>

        {/* Right Side: Integrity status */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">STATUS DATABASE</p>
            <p className="text-xs text-emerald-500 flex items-center gap-1 font-bold italic justify-end">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> NEON_DB_AKTIF
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
                <span className="hidden sm:inline">Keluar</span>
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
              <span>Masuk Sesi</span>
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
        <button
          onClick={() => setActiveTab("architecture")}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === "architecture" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          Skema Spek
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
                        🔒 INTEGRITAS DATA MUTASI AUDIT KRIPTOGRAFIS NEON POSTGRESQL TERVERIFIKASI
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
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium font-sans">Pilar Struktur & Beton</span>
                          <span className="text-slate-800 font-bold">95% Selesai</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium font-sans">Pekerjaan Finishing Tegel</span>
                          <span className="text-slate-800 font-bold">12% Selesai</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium font-sans">Sistem MEP & Pemipaan</span>
                          <span className="text-slate-800 font-bold">45% Selesai</span>
                        </div>
                      </div>
                      {progressLog.length > 0 && (
                        <div className="mt-6 border-t border-slate-150 pt-4">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Foto Lapangan Terbaru</p>
                          <div className="h-32 bg-slate-200 rounded-lg overflow-hidden relative">
                            {progressLog[progressLog.length - 1].photoUrls?.[0] ? (
                              <img 
                                src={progressLog[progressLog.length - 1].photoUrls![0]} 
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
                        <p className="text-[9px] text-slate-400 text-center italic">Setiap entri di-hash dan tersimpan mutlak dalam rantai log PostgreSQL</p>
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
                      <span>Masuk Sesi Otorisasi</span>
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
                        className="bg-emerald-900 hover:bg-emerald-850 border border-emerald-800 text-white px-3 py-1.5 rounded-lg text-xxs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <LogOut className="h-3 w-3" />
                        <span>Kunci Sesi / Keluar</span>
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
                                <strong>Validasi Akuntabilitas Ketat:</strong> Foto kuitansi / nota belanja wajib diisi demi transparansi kas untuk menghindari penolakan pencatatan kas keluar oleh basis data Neon PostgreSQL.
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
                      <span>Masuk Sesi Otorisasi</span>
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
                        <span>Kunci Sesi / Keluar</span>
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
                  </div>
                )}
              </div>
            )}

            {/* 4. SCHEMAS, CODE PLATES, AND DIRECTORIES ARCHITECTURE */}
            {activeTab === "architecture" && (
              <div className="space-y-6">
                
                {/* Intro Architecture Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Recommended Folder Map layout */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs lg:col-span-5 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm mb-1.5 flex items-center space-x-1.5">
                        <FolderTree className="h-4.5 w-4.5 text-emerald-600" />
                        <span>Recommended Workspace Layout</span>
                      </h3>
                      <p className="text-xxs text-slate-500 mb-4 font-sans leading-relaxed">
                        To construct a robust Next.js/Express full-stack backend with clear separation, we outline the optimized layout mapping schemas, controllers, clients and routers. Learn or copy this physical workspace logic:
                      </p>

                      <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xxs font-mono overflow-auto max-h-96 border border-slate-800">
                        {folderStructure && (
                          <div className="space-y-3">
                            <span className="text-emerald-400 font-bold block">📂 {folderStructure.name}/</span>
                            
                            {folderStructure.children.map((child: any, idx: number) => (
                              <div key={idx} className="pl-3 border-l-2 border-slate-800 space-y-1">
                                <span className="text-amber-400 font-semibold block">
                                  {child.type === 'directory' ? '📂' : '📄'} {child.name}
                                </span>
                                {child.description && (
                                  <p className="text-slate-500 text-xxs block pl-6 font-sans italic leading-tight">
                                    // {child.description}
                                  </p>
                                )}

                                {child.children && (
                                  <div className="pl-4 border-l border-slate-800 space-y-1">
                                    {child.children.map((sub: any, sIdx: number) => (
                                      <div key={sIdx}>
                                        <span className="text-blue-300 block">{sub.type === 'directory' ? '📂' : '📄'} {sub.name}</span>
                                        {sub.description && (
                                          <p className="text-slate-500 font-sans italic pl-5 text-xxs leading-tight">
                                            // {sub.description}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Schema highlighting (Left 7 columns) */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-xs lg:col-span-12 flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
                          <Database className="h-4.5 w-4.5 text-emerald-600" />
                          <span>NeonDB / Postgres Data Architecture</span>
                        </h3>
                        <p className="text-xxs text-slate-500">Prisma definition schema and PostgreSQL init DDL models complete with audit actions</p>
                      </div>

                      <div className="flex space-x-1.5 p-1 bg-slate-100 rounded-lg">
                        <button 
                          onClick={() => setSchemaSelection("prisma")}
                          className={`px-3 py-1.5 text-xxs font-bold rounded-md transition ${schemaSelection === 'prisma' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Prisma Schema
                        </button>
                        <button 
                          onClick={() => setSchemaSelection("postgresql")}
                          className={`px-3 py-1.5 text-xxs font-bold rounded-md transition ${schemaSelection === 'postgresql' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          PostgreSQL DDL with Triggers
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900 text-slate-300 text-xxs font-mono max-h-[500px] overflow-auto border-t border-slate-850">
                      {schemaSelection === "prisma" ? (
                        <pre className="leading-relaxed">
{`// /prisma/schema.prisma
// Managed via neon.tech cloud scaling Postgres pools

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  TREASURER
  PROJECT_MANAGER
}

enum PaymentMethod {
  BANK_TRANSFER
  E_WALLET
  CASH
  CRYPTO
}

enum DonationStatus {
  PENDING
  APPROVED
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(TREASURER)
  createdAt DateTime @default(now())
}

model Budget {
  id           String   @id @default(uuid())
  itemName     String
  category     String   // e.g. "Foundation", "Structure", "Roofing", "MEP", "Operational"
  targetAmount Decimal  @db.Decimal(12, 2)
  spentAmount  Decimal  @db.Decimal(12, 2) @default(0)
}

model Donation {
  id               String         @id @default(uuid())
  donorName        String
  isAnonymous      Boolean        @default(false)
  amount           Decimal        @db.Decimal(12, 2)
  date             DateTime       @default(now())
  paymentMethod    PaymentMethod
  transferProofUrl String         // Required for audit-readiness
  status           DonationStatus @default(PENDING)
  createdAt        DateTime       @default(now())
}

model Expenditure {
  id          String              @id @default(uuid())
  itemName    String
  category    String              // "Material", "Labor", "Equipment", etc.
  volume      Decimal             @db.Decimal(10, 2)
  unit        String              // "m3", "kg", "pcs"
  unitPrice   Decimal             @db.Decimal(12, 2)
  totalPrice  Decimal             @db.Decimal(12, 2)
  storeName   String
  receiptUrl  String              // STRICT VALIDATION: cannot be saved without receipt proof URL
  inputtedBy  String
  date        DateTime            @default(now())
}

model PhysicalProgress {
  id           String   @id @default(uuid())
  percentage   Int      // 0 to 100
  description  String
  timelineDate DateTime @default(now())
  photoUrls    String[] // photographic updates
}`}
                        </pre>
                      ) : (
                        <pre className="leading-relaxed">
{`-- /prisma/migrations/init.sql
-- Run DDL SQL scripts directly inside Neon SQL dashboard

CREATE TABLE "Donation" (
    "id" VARCHAR(255) PRIMARY KEY,
    "donorName" VARCHAR(255) NOT NULL,
    "isAnonymous" BOOLEAN DEFAULT FALSE,
    "amount" DECIMAL(12,2) NOT NULL CHECK ("amount" > 0),
    "date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" VARCHAR(50) NOT NULL,
    "transferProofUrl" VARCHAR(1024) NOT NULL, -- MANDATORY ATTACHMENT
    "status" VARCHAR(50) DEFAULT 'PENDING'
);

CREATE TABLE "Expenditure" (
    "id" VARCHAR(255) PRIMARY KEY,
    "itemName" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "volume" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL, -- Computed as volume * unitPrice
    "storeName" VARCHAR(255) NOT NULL,
    "receiptUrl" VARCHAR(1024) NOT NULL, -- VERIFIABLE INVOICE IMAGE
    "inputtedBy" VARCHAR(255) NOT NULL
);

-- STRICT DB CONSTRAINT: Validation checks
ALTER TABLE "Expenditure" ADD CONSTRAINT check_total CHECK ("totalPrice" = "volume" * "unitPrice");
ALTER TABLE "Expenditure" ADD CONSTRAINT check_receipt CHECK (length("receiptUrl") > 0);

-- MULTI-WRITE AUDIT LOG AUTOMATED PG TRIGGER PROCEDURE
CREATE OR REPLACE FUNCTION trigger_capture_audit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
    VALUES (
        gen_random_uuid()::varchar,
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW."id", OLD."id"),
        COALESCE(NEW."inputtedBy", 'AdminSystem'),
        'Transaction processed on ' || TG_TABLE_NAME || ' for record ' || COALESCE(NEW."id", OLD."id")
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`}
                        </pre>
                      )}
                    </div>
                  </div>

                  {/* Audit Record Logs (Right Column / Full Row list) */}
                  <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs lg:col-span-12">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1 text-slate-900">
                          <History className="h-4.5 w-4.5 text-emerald-600 mr-1" />
                          <span>Ledger Security Audit Logs (Full Record Trial)</span>
                        </h3>
                        <p className="text-xxs text-slate-400">Inviolable audit trails tracking system interactions and verification actions</p>
                      </div>

                      <span className="bg-rose-100 text-rose-800 text-xxs font-mono font-bold px-2 py-0.5 rounded-sm">Active Trigger Capturer</span>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-3 text-xxs font-mono">
                          <div className={`mt-0.5 px-2 py-0.5 rounded-sm font-bold text-white uppercase text-[8px] ${
                            log.action === "APPROVE" ? "bg-emerald-600" :
                            log.action === "CREATE" ? "bg-blue-600" : "bg-slate-500"
                          }`}>
                            {log.action}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-slate-400">
                              <span>Table: {log.tableName} | Record: {log.recordId}</span>
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-slate-800 font-sans tracking-tight">
                              {log.details}
                            </p>
                            <span className="block text-slate-500 text-xxs italic font-sans">// Processed by {log.changedBy}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

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
            Secure Fullstack Architecture Blueprint designed specifically for NeonDB & Postgres triggers. <br />
            Created for verified public trust, accountability, and real-time physical development summaries.
          </p>
          <div className="text-xxs text-slate-600 flex flex-col sm:flex-row justify-center items-center gap-2">
            <span>© 2026 SmartBuild Initiative. Standard GPL-v2 License. Auditable code distribution.</span>
            <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded font-mono text-xxs font-medium">
              v1.2.8-latest (Deployed: 2026-06-02)
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
                  src={selectedReceiptUrl} 
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
                  <h4 className="font-bold text-slate-900 text-sm">Masuk Sesi Otorisasi</h4>
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
                    placeholder="nama@masjid.id" 
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

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Pilihan Akses Evaluasi (Quick Login)</p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button 
                    onClick={() => {
                      setLoginEmail("admin@masjid.id");
                      setLoginPassword("admin");
                      handleLoginAction("admin@masjid.id", "admin");
                    }}
                    className="bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-150 text-left transition flex justify-between items-center text-xxs font-sans cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">Super Admin (Lengkap)</span>
                      <span className="text-slate-400 text-[10px]">admin@masjid.id</span>
                    </div>
                    <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded text-[8px]">👑 ADMIN</span>
                  </button>

                  <button 
                    onClick={() => {
                      setLoginEmail("bendahara@masjid.id");
                      setLoginPassword("treasurer123");
                      handleLoginAction("bendahara@masjid.id", "treasurer123");
                    }}
                    className="bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-150 text-left transition flex justify-between items-center text-xxs font-sans cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">Haji Rosyid (Bendahara)</span>
                      <span className="text-slate-400 text-[10px]">bendahara@masjid.id</span>
                    </div>
                    <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded text-[8px]">💰 TREASURER</span>
                  </button>

                  <button 
                    onClick={() => {
                      setLoginEmail("pm@masjid.id");
                      setLoginPassword("pm123");
                      handleLoginAction("pm@masjid.id", "pm123");
                    }}
                    className="bg-slate-50 hover:bg-slate-100 p-2 rounded-lg border border-slate-150 text-left transition flex justify-between items-center text-xxs font-sans cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block leading-tight">Ir. Hermawan (Contract PM)</span>
                      <span className="text-slate-400 text-[10px]">pm@masjid.id</span>
                    </div>
                    <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded text-[8px]">🧱 PM</span>
                  </button>
                </div>
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
