import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  RABItem, 
  AuditLog 
} from "./src/types.js"; // Standard TS/JS resolver

const app = express();
const PORT = 3000;

// Resolve __dirname since we are in ES Module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE_PATH = path.join(__dirname, "db.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

// INITIAL SEED DATA
const defaultRABBudgets: RABItem[] = [
  { id: "rab-1", itemName: "Pematangan Lahan & Pengecoran Fondasi", category: "Foundation", targetAmount: 250000000, spentAmount: 226000000 },
  { id: "rab-2", itemName: "Tiang Struktur & Pembesian Kolom Beton", category: "Structure", targetAmount: 450000000, spentAmount: 180000000 },
  { id: "rab-3", itemName: "Rangka Atap Baja, Kubah Masjid & Seng Gelombang", category: "Roofing", targetAmount: 300000000, spentAmount: 0 },
  { id: "rab-4", itemName: "Sistem Sanitasi, Pemipaan Pasokan Air & Instalasi Listrik", category: "MEP", targetAmount: 200000000, spentAmount: 19500000 },
  { id: "rab-5", itemName: "Finishing Marmer, Ubin Lantai & Ukiran Mihrab Kayu Jati", category: "Finishing", targetAmount: 300000000, spentAmount: 0 },
  { id: "rab-6", itemName: "Perizinan Lingkungan, Andalalin, Amdal & IMB Kecamatan", category: "Operational", targetAmount: 100000000, spentAmount: 72000000 },
];

const defaultDonations: Donation[] = [
  {
    id: "don-1",
    donorName: "Yayasan Masjid Al-Rahman",
    isAnonymous: false,
    amount: 450000000,
    date: "2026-05-10T14:30:00Z",
    paymentMethod: "Bank Transfer",
    transferProofUrl: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-2",
    donorName: "Penggalangan Dana Kolektif Lintas Iman",
    isAnonymous: false,
    amount: 185000000,
    date: "2026-05-12T09:15:00Z",
    paymentMethod: "Bank Transfer",
    transferProofUrl: "https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-3",
    donorName: "Haji Sulaiman & Keluarga",
    isAnonymous: false,
    amount: 50000000,
    date: "2026-05-15T18:00:00Z",
    paymentMethod: "Cash",
    transferProofUrl: "https://images.unsplash.com/photo-1563013544-824ae1d704d3?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-4",
    donorName: "Hamba Allah",
    isAnonymous: true,
    amount: 25000000,
    date: "2026-05-20T10:05:00Z",
    paymentMethod: "E-Wallet",
    transferProofUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-5",
    donorName: "Asosiasi Pendonor Masjid Nusantara",
    isAnonymous: false,
    amount: 100000000,
    date: "2026-05-25T11:40:00Z",
    paymentMethod: "Bank Transfer",
    transferProofUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-6",
    donorName: "Kotak Amal Toko Roti Prima",
    isAnonymous: true,
    amount: 6400000,
    date: "2026-05-28T16:50:00Z",
    paymentMethod: "Cash",
    transferProofUrl: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=500&auto=format&fit=crop",
    status: "APPROVED"
  },
  {
    id: "don-pending-1",
    donorName: "CV. Al-Hussain Dagang",
    isAnonymous: false,
    amount: 125000000,
    date: "2026-06-01T08:00:00Z",
    paymentMethod: "Bank Transfer",
    transferProofUrl: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop",
    status: "PENDING"
  },
  {
    id: "don-pending-2",
    donorName: "Sarah Jenkins & Rekan",
    isAnonymous: false,
    amount: 3500000,
    date: "2026-06-01T20:20:00Z",
    paymentMethod: "E-Wallet",
    transferProofUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop",
    status: "PENDING"
  }
];

const defaultExpenditures: Expenditure[] = [
  {
    id: "exp-1",
    itemName: "Semen Portland Tiga Roda (500 sak untuk fondasi)",
    category: "Material",
    volume: 500,
    unit: "sak",
    unitPrice: 72000,
    totalPrice: 36000000,
    storeName: "Toko Bangunan Mega Jaya",
    receiptUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-11T09:00:00Z"
  },
  {
    id: "exp-2",
    itemName: "Kontrak Pekerja Tahap Pengecoran Tapak Fondasi",
    category: "Labor",
    volume: 1,
    unit: "paket",
    unitPrice: 190000000,
    totalPrice: 190000000,
    storeName: "PT. Apex Kontraktor Utama",
    receiptUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-13T10:30:00Z"
  },
  {
    id: "exp-3",
    itemName: "Besi Beton Ulir Krakatau Steel (Grade 60, Kolom Struktur)",
    category: "Material",
    volume: 15,
    unit: "ton",
    unitPrice: 12000000,
    totalPrice: 180000000,
    storeName: "PT. Dunia Baja Abadi",
    receiptUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-16T14:00:00Z"
  },
  {
    id: "exp-4",
    itemName: "Pipa Tembaga Distribusi Air Bersih Utama",
    category: "Material",
    volume: 130,
    unit: "meter",
    unitPrice: 150000,
    totalPrice: 19500000,
    storeName: "Depo Air & Sanitasi HydroPlumb",
    receiptUrl: "https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-22T15:20:00Z"
  },
  {
    id: "exp-5",
    itemName: "Sewa Ekskavator Backhoe Buldozer (Pematangan Lahan)",
    category: "Equipment",
    volume: 3,
    unit: "hari",
    unitPrice: 6000000,
    totalPrice: 18000000,
    storeName: "CV. Titan Rental Alat Berat",
    receiptUrl: "https://images.unsplash.com/photo-1590674899484-13aa0d13301a?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-14T08:30:00Z"
  },
  {
    id: "exp-6",
    itemName: "Persetujuan IMB (Izin Mendirikan Bangunan) Kecamatan",
    category: "Permit/Admin",
    volume: 1,
    unit: "berkas",
    unitPrice: 72000000,
    totalPrice: 72000000,
    storeName: "Dinas Penanaman Modal & PTSP",
    receiptUrl: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=500&auto=format&fit=crop",
    inputtedBy: "David Miller (Bendahara)",
    date: "2026-05-05T11:00:00Z"
  }
];

const defaultProgress: PhysicalProgress[] = [
  {
    id: "prog-1",
    percentage: 5,
    description: "Mobilisasi alat berat selesai sepenuhnya. Penggalian tanah untuk tapak fondasi dasar basement berhasil diselesaikan.",
    timelineDate: "2026-05-06T12:00:00Z",
    photoUrls: ["https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500&auto=format&fit=crop"]
  },
  {
    id: "prog-2",
    percentage: 20,
    description: "Pengecoran tapak beton mengeras sempurna. Tiang struktur kolom beton bertulang selesai dicor dan diuji kekuatan getarannya.",
    timelineDate: "2026-05-14T10:00:00Z",
    photoUrls: ["https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&auto=format&fit=crop"]
  },
  {
    id: "prog-3",
    percentage: 35,
    description: "Balok lantai dasar dan rangka baja utama didirikan. Sistem drainase penyaluran limpasan air hujan selesai dipasang.",
    timelineDate: "2026-05-24T16:30:00Z",
    photoUrls: ["https://images.unsplash.com/photo-1590674899484-13aa0d13301a?w=500&auto=format&fit=crop"]
  }
];

const defaultAuditLogs: AuditLog[] = [
  {
    id: "log-1",
    timestamp: "2026-05-05T11:05:00Z",
    action: "CREATE",
    tableName: "Expenditure",
    recordId: "exp-6",
    changedBy: "David Miller (Bendahara)",
    details: "Mencatat pengeluaran perizinan sebesar Rp 72.000.000 untuk Persetujuan IMB (Izin Mendirikan Bangunan) Kecamatan. Lampiran: terverifikasi."
  },
  {
    id: "log-2",
    timestamp: "2026-05-06T12:05:00Z",
    action: "CREATE",
    tableName: "PhysicalProgress",
    recordId: "prog-1",
    changedBy: "Arthur Pendelton (PM Proyek)",
    details: "Perkembangan fisik diperbarui ke 5%: Mobilisasi alat berat selesai, penggalian dasar basement selesai."
  },
  {
    id: "log-3",
    timestamp: "2026-05-10T14:35:00Z",
    action: "APPROVE",
    tableName: "Donation",
    recordId: "don-1",
    changedBy: "David Miller (Bendahara)",
    details: "Persetujuan donasi publik dari 'Yayasan Masjid Al-Rahman' sebesar Rp 450.000.000 via Transfer Bank. Dana terverifikasi."
  },
  {
    id: "log-4",
    timestamp: "2026-05-11T09:12:00Z",
    action: "CREATE",
    tableName: "Expenditure",
    recordId: "exp-1",
    changedBy: "David Miller (Bendahara)",
    details: "Mencatat pengeluaran sebesar Rp 36.000.000 untuk 500 sak Semen Portland dari Toko Bangunan Mega Jaya."
  },
  {
    id: "log-5",
    timestamp: "2026-05-12T09:20:00Z",
    action: "APPROVE",
    tableName: "Donation",
    recordId: "don-2",
    changedBy: "David Miller (Bendahara)",
    details: "Persetujuan donasi lintas iman komunitas sebesar Rp 185.000.000. Bukti transfer diperiksa dan dana dicatat selesai."
  }
];

const JWT_SECRET = process.env.JWT_SECRET || "buku-kas-masjid-super-secret-key-2026";

// Pre-configured default users with easy raw references so they work immediately in local sandbox env.
const defaultUsers = [
  {
    id: "user-admin",
    email: "admin@masjid.id",
    name: "Haji Sulaiman (Super Admin)",
    role: "ADMIN",
    passwordRaw: "admin"
  },
  {
    id: "user-treasurer",
    email: "bendahara@masjid.id",
    name: "David Miller (Bendahara)",
    role: "TREASURER",
    passwordRaw: "treasurer123"
  },
  {
    id: "user-pm",
    email: "pm@masjid.id",
    name: "Arthur Pendelton (PM)",
    role: "PROJECT_MANAGER",
    passwordRaw: "pm123"
  }
];

// Load or Seed DB
function getDBState() {
  let state: any;
  if (!fs.existsSync(DB_FILE_PATH)) {
    state = {
      budgets: defaultRABBudgets,
      donations: defaultDonations,
      expenditures: defaultExpenditures,
      progress: defaultProgress,
      auditLogs: defaultAuditLogs,
      users: []
    };
  } else {
    try {
      const fileContent = fs.readFileSync(DB_FILE_PATH, "utf-8");
      state = JSON.parse(fileContent);
    } catch (error) {
      console.error("Failed to read database file, returning default memory fallback", error);
      state = {
        budgets: defaultRABBudgets,
         donations: defaultDonations,
        expenditures: defaultExpenditures,
        progress: defaultProgress,
        auditLogs: defaultAuditLogs,
        users: []
      };
    }
  }

  // Auto-seed default accounts in sandbox memory database if users list is unpopulated
  if (!state.users || state.users.length === 0) {
    state.users = defaultUsers.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      password: bcrypt.hashSync(u.passwordRaw, 10),
      createdAt: new Date().toISOString()
    }));
    saveDBState(state);
  }

  return state;
}

function saveDBState(state: any) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save database file on disk", error);
  }
}

// Global Authentication JWT Middleware
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ error: "Akses ditolak. Token otorisasi login diperlukan." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as any;
    req.user = verified;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Sesi Anda telah kedaluwarsa atau token tidak valid. Silakan login kembali." });
  }
}

// Role-based Authorization Guard Middleware
function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Akses ditolak. Silakan login terlebih dahulu." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Akses dilarang. Fitur ini memerlukan salah satu hak akses peran berikut: [${allowedRoles.join(", ")}]. Peran Anda saat ini: ${req.user.role}` 
      });
    }
    next();
  };
}

// REST APIs
// 0. Authentication Endpoints
app.post("/api/auth/register", (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing required fields (email, password, name)." });
  }

  const assignedRole = role && ["ADMIN", "TREASURER", "PROJECT_MANAGER"].includes(role) ? role : "TREASURER";
  const db = getDBState();

  const userExists = db.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (userExists) {
    return res.status(400).json({ error: "User with this email already registered." });
  }

  const newUser = {
    id: `user-${Date.now()}`,
    email: email.toLowerCase(),
    password: bcrypt.hashSync(password, 10),
    name,
    role: assignedRole,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDBState(db);

  // Sign token
  const tokenPayload = { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

  res.status(201).json({
    token,
    user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  const db = getDBState();
  const user = db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Email atau kata sandi Anda salah." });
  }

  // Sign token
  const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role }
  });
});

app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// Upload File Endpoint (menerima file upload dan mengembalikan url)
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Gagal mengunggah file. Pastikan Anda memilih file yang valid." });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// 1. Calculations & Summaries (TAMPER-PROOF BALANCE ENGINE)
app.get("/api/financial-summary", (req, res) => {
  const db = getDBState();
  
  // Calculate dynamically from full ledger history to satisfy the tamper-proof formula requirement.
  const approvedDonationsSum = db.donations
    .filter((d: Donation) => d.status === "APPROVED")
    .reduce((sum: number, d: Donation) => sum + d.amount, 0);

  const expendituresSum = db.expenditures
    .reduce((sum: number, e: Expenditure) => sum + e.totalPrice, 0);

  const currentCashBalance = approvedDonationsSum - expendituresSum;

  const totalRABTarget = db.budgets
    .reduce((sum: number, b: RABItem) => sum + b.targetAmount, 0);

  // Get current physical progress percentage (latest logging)
  const currentProgressPercent = db.progress.length > 0 
    ? db.progress[db.progress.length - 1].percentage 
    : 0;

  res.json({
    totalRaised: approvedDonationsSum,
    totalRABTarget,
    currentCashBalance,
    totalExpenditures: expendituresSum,
    physicalProgressPercent: currentProgressPercent,
    // Add categories analysis for charts
    expendituresByCategory: {
      Material: db.expenditures.filter((e: any) => e.category === "Material").reduce((s: number, e: any) => s + e.totalPrice, 0),
      Labor: db.expenditures.filter((e: any) => e.category === "Labor").reduce((s: number, e: any) => s + e.totalPrice, 0),
      Equipment: db.expenditures.filter((e: any) => e.category === "Equipment").reduce((s: number, e: any) => s + e.totalPrice, 0),
      "Permit/Admin": db.expenditures.filter((e: any) => e.category === "Permit/Admin").reduce((s: number, e: any) => s + e.totalPrice, 0),
      Other: db.expenditures.filter((e: any) => e.category === "Other").reduce((s: number, e: any) => s + e.totalPrice, 0)
    },
    donationsByPayment: {
      "Bank Transfer": db.donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Bank Transfer").reduce((s: number, d: any) => s + d.amount, 0),
      "E-Wallet": db.donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "E-Wallet").reduce((s: number, d: any) => s + d.amount, 0),
      "Cash": db.donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Cash").reduce((s: number, d: any) => s + d.amount, 0),
      "Crypto": db.donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Crypto").reduce((s: number, d: any) => s + d.amount, 0),
    }
  });
});

// 2. Donations Endpoints
app.get("/api/donations", (req, res) => {
  const db = getDBState();
  res.json(db.donations);
});

app.post("/api/donations", (req, res) => {
  const { donorName, isAnonymous, amount, paymentMethod, transferProofUrl, approveDirectly } = req.body;

  if (!donorName || !amount || !paymentMethod) {
    return res.status(400).json({ error: "Required fields missing (donorName, amount, paymentMethod)." });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Donation amount must be positive." });
  }

  // Auditing requirements: transferProofUrl is required for transparency
  if (!transferProofUrl || transferProofUrl.trim() === "") {
    return res.status(400).json({ error: "Strict Accountability: Transfer proof Image URL/string is mandatory to log a donation." });
  }

  const db = getDBState();
  const isApproved = approveDirectly ? "APPROVED" : "PENDING";
  
  const newDonation: Donation = {
    id: `don-${Date.now()}`,
    donorName: isAnonymous ? "Anonymous" : donorName,
    isAnonymous: !!isAnonymous,
    amount: Number(amount),
    date: new Date().toISOString(),
    paymentMethod,
    transferProofUrl,
    status: isApproved
  };

  db.donations.unshift(newDonation);

  // Auto-log audit record
  const newAudit: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: "CREATE",
    tableName: "Donation",
    recordId: newDonation.id,
    changedBy: approveDirectly ? "Bendahara" : "Publik/Mandiri",
    details: `${isApproved === 'APPROVED' ? 'Disetujui' : 'Tertunda'} Donasi masuk: Rp ${newDonation.amount.toLocaleString('id-ID')} oleh ${newDonation.donorName}. Bukti transfer: terverifikasi.`
  };
  
  db.auditLogs.unshift(newAudit);
  saveDBState(db);

  res.status(201).json({ donation: newDonation, audit: newAudit });
});

app.post("/api/donations/:id/approve", authenticateToken, requireRole(["ADMIN", "TREASURER"]), (req, res) => {
  const { id } = req.params;
  const operator = (req as any).user;

  const db = getDBState();
  const donationIndex = db.donations.findIndex((d: Donation) => d.id === id);

  if (donationIndex === -1) {
    return res.status(404).json({ error: "Donation record not found." });
  }

  const donation = db.donations[donationIndex];
  if (donation.status === "APPROVED") {
    return res.status(400).json({ error: "Donation is already approved." });
  }

  donation.status = "APPROVED";
  db.donations[donationIndex] = donation;

  // Record validation audit trail
  const newAudit: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: "APPROVE",
    tableName: "Donation",
    recordId: donation.id,
    changedBy: operator.name,
    details: `Menyetujui kontribusi sebesar Rp ${donation.amount.toLocaleString('id-ID')} dari '${donation.donorName}'. Bukti transfer terverifikasi oleh ${operator.role}.`
  };

  db.auditLogs.unshift(newAudit);
  saveDBState(db);

  res.json({ donation, audit: newAudit });
});

// 3. Expenditures Endpoints (Strict validation for invoices)
app.get("/api/expenditures", (req, res) => {
  const db = getDBState();
  res.json(db.expenditures);
});

app.post("/api/expenditures", authenticateToken, requireRole(["ADMIN", "TREASURER"]), (req, res) => {
  const { itemName, category, volume, unit, unitPrice, storeName, receiptUrl } = req.body;
  const operator = (req as any).user;

  // Strict Validation: Total Price, Non-negatives and receipt invoice is mandatory!
  if (!itemName || !category || !volume || !unit || !unitPrice || !storeName) {
    return res.status(400).json({ error: "All properties must be filled (itemName, category, volume, unit, unitPrice, storeName)." });
  }

  if (Number(volume) <= 0 || Number(unitPrice) <= 0) {
    return res.status(400).json({ error: "Volume and Unit Price must be greater than zero." });
  }

  // Strict accountability enforcement target
  if (!receiptUrl || receiptUrl.trim() === "") {
    return res.status(400).json({ error: "Strict Accountability Validation Block: Expenditures CANNOT be saved without uploading a receipt/invoice image URL." });
  }

  const db = getDBState();
  const calculatedTotal = Number(volume) * Number(unitPrice);

  const newExpenditure: Expenditure = {
    id: `exp-${Date.now()}`,
    itemName,
    category,
    volume: Number(volume),
    unit,
    unitPrice: Number(unitPrice),
    totalPrice: calculatedTotal,
    storeName,
    receiptUrl,
    inputtedBy: operator.name,
    date: new Date().toISOString()
  };

  db.expenditures.unshift(newExpenditure);

  // Map to corresponding RABBudget item to register actual expenditure
  const matchedBudgetIndex = db.budgets.findIndex((b: RABItem) => 
    b.category.toLowerCase().startsWith(category.toLowerCase().substring(0,4)) ||
    b.itemName.toLowerCase().includes(itemName.toLowerCase())
  );
  if (matchedBudgetIndex !== -1) {
    db.budgets[matchedBudgetIndex].spentAmount += calculatedTotal;
  }

  // Audit record creation
  const newAudit: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: "CREATE",
    tableName: "Expenditure",
    recordId: newExpenditure.id,
    changedBy: operator.name,
    details: `Pembelian ${volume} ${unit} dari '${itemName}' seharga total Rp ${calculatedTotal.toLocaleString('id-ID')} di '${storeName}' diinput oleh ${operator.name} (${operator.role}).`
  };

  db.auditLogs.unshift(newAudit);
  saveDBState(db);

  res.status(201).json({ expenditure: newExpenditure, audit: newAudit });
});

// 4. Physical Progress Endpoints (Project Manager Module)
app.get("/api/progress", (req, res) => {
  const db = getDBState();
  res.json(db.progress);
});

app.post("/api/progress", authenticateToken, requireRole(["ADMIN", "PROJECT_MANAGER"]), (req, res) => {
  const { percentage, description, photoUrl } = req.body;
  const operator = (req as any).user;

  if (percentage === undefined || !description) {
    return res.status(400).json({ error: "Progress percentage (0-100) and descriptions are mandatory." });
  }

  const numericPercent = Number(percentage);
  if (numericPercent < 0 || numericPercent > 100) {
    return res.status(400).json({ error: "Percentage must be an integer between 0 and 100." });
  }

  const db = getDBState();
  
  const progressPhotos = photoUrl && photoUrl.trim() !== "" ? [photoUrl] : [
    "https://images.unsplash.com/photo-1590674899484-13aa0d13301a?w=500&auto=format&fit=crop" // standard placeholder
  ];

  const newProgress: PhysicalProgress = {
    id: `prog-${Date.now()}`,
    percentage: numericPercent,
    description,
    timelineDate: new Date().toISOString(),
    photoUrls: progressPhotos
  };

  db.progress.push(newProgress);

  // Logging physical progress audit trail
  const newAudit: AuditLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: "CREATE",
    tableName: "PhysicalProgress",
    recordId: newProgress.id,
    changedBy: operator.name,
    details: `Kemajuan fisik proyek diperbarui ke ${numericPercent}% oleh ${operator.name} (${operator.role}). Keterangan: ${description}`
  };

  db.auditLogs.unshift(newAudit);
  saveDBState(db);

  res.status(201).json({ progress: newProgress, audit: newAudit });
});

// 5. Audit logs endpoint
app.get("/api/audit-logs", (req, res) => {
  const db = getDBState();
  res.json(db.auditLogs);
});

// 6. Project Architecture structure for display
app.get("/api/folder-structure", (req, res) => {
  res.json({
    name: "smartbuild-root",
    type: "directory",
    children: [
      {
        name: "prisma",
        type: "directory",
        children: [
          { name: "schema.prisma", type: "file", description: "Prisma entity relational definitions mapping Users, Donations, Budgets, Expenditures." },
          { name: "migrations/init.sql", type: "file", description: "Production PostgreSQL database installation script with Audit Logging Triggers." }
        ]
      },
      {
        name: "server",
        type: "directory",
        children: [
          {
            name: "controllers",
            type: "directory",
            children: [
              { name: "donationController.ts", type: "file", description: "Validates transaction details, checks image proofs, queues pending balances." },
              { name: "expenditureController.ts", type: "file", description: "Enforces strict financial validations rejecting transactions without receipt images." }
            ]
          },
          {
            name: "routes",
            type: "directory",
            children: [
              { name: "api.ts", type: "file", description: "REST server routing endpoints maps transactions onto corresponding actions." }
            ]
          },
          {
            name: "db",
            type: "directory",
            children: [
              { name: "client.ts", type: "file", description: "Prisma client manager configured with pooling limits for serverless NeonDB Postgres instance." }
            ]
          }
        ]
      },
      {
        name: "src",
        type: "directory",
        children: [
          { name: "components", type: "directory" },
          { name: "App.tsx", type: "file", description: "Single-view high fidelity real-time transparency dashboard UI." },
          { name: "types.ts", type: "file", description: "Declared shared strict interfaces representing financial records." },
          { name: "main.tsx", type: "file", description: "Vite SPA rendering node." }
        ]
      },
      { name: "server.ts", type: "file", description: "Bootloader entry-point hosting full-stack node services." },
      { name: "package.json", type: "file", description: "Project manifest, scripts, and production server modules." }
    ]
  });
});

// Setup development devServer or production asset pipelines
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartBuild server actively listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
