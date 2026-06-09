// Vercel Production Deployment Patch - June 2026
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
// PrismaClient is dynamically imported on demand to prevent top-level module load crashes in serverless environments
import { 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  RABItem, 
  AuditLog 
} from "./src/types.js"; // Standard TS/JS resolver

export const app = express();

// Define global prisma lazy-initializer to support zero-downtime offline fallbacks
let _prisma: any = null;
let prismaInitialized = false;

async function getPrismaClient() {
  if (prismaInitialized) return _prisma;
  if (process.env.DATABASE_URL) {
    try {
      const prismaModule = await import("@prisma/client");
      _prisma = new prismaModule.PrismaClient();
      console.log("PrismaClient successfully initialized dynamically.");
    } catch (err) {
      console.error("PrismaClient initialization failed (lazy load):", err);
      _prisma = null;
    }
  } else {
    _prisma = null;
  }
  prismaInitialized = true;
  return _prisma;
}

const PORT = 3000;

// Resolve local directory path constants safely for both CommonJS and ES Module environments
const __dirname = process.cwd();
const __filename = path.join(__dirname, "server.ts");

let DB_FILE_PATH = path.join(process.cwd(), "db.json");
if (process.env.VERCEL) {
  const tempDbPath = "/tmp/db.json";
  try {
    if (!fs.existsSync(tempDbPath)) {
      if (fs.existsSync(DB_FILE_PATH)) {
        fs.copyFileSync(DB_FILE_PATH, tempDbPath);
      } else {
        // Safe check for relative fallback paths
        const fallbackPath = path.join(__dirname, "db.json");
        if (fs.existsSync(fallbackPath)) {
          fs.copyFileSync(fallbackPath, tempDbPath);
        }
      }
    }
  } catch (err) {
    console.error("Failed to copy db.json to /tmp", err);
  }
  DB_FILE_PATH = tempDbPath;
}
let UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure upload directory exists, with robust fallback to /tmp/uploads for read-only environments (e.g., Cloud Run, Vercel)
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  // Verify write permission actively
  const testFile = path.join(UPLOADS_DIR, ".write-test");
  fs.writeFileSync(testFile, "test");
  fs.unlinkSync(testFile);
} catch (error) {
  console.warn("Could not write to local uploads directory, falling back to /tmp/uploads:", error);
  UPLOADS_DIR = "/tmp/uploads";
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
  } catch (tmpError) {
    console.error("Critical error: Could not create temporary uploads directory either:", tmpError);
  }
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
    donorName: "Rudi P & Keluarga",
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
    email: "admin@pintarbangun.vercel.app",
    name: "Rudi P",
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

  // Auto-seed default project configurations if missing in sandbox memory database
  if (!state.projectConfig) {
    state.projectConfig = {
      id: "project-default",
      name: "Proyek Utama Pembangunan Masjid At-Taqwa",
      type: "renovasi",
      fundingSource: "donasi",
      status: "public",
      projectStatus: "berjalan",
      budget: 1600000000,
      description: "Pembangunan dan perluasan kapasitas ibadah utama serta fasilitas dakwah Masjid At-Taqwa.",
      initialized: true,
      initializedAt: "2026-05-10T14:30:00Z"
    };
    saveDBState(state);
  }

  // Ensure projects array exists to track projects made by super admin
  if (!state.projects) {
    state.projects = [
      {
        id: "project-default",
        name: "Proyek Utama Pembangunan Masjid At-Taqwa",
        type: "renovasi",
        fundingSource: "donasi",
        status: "public",
        projectStatus: "berjalan",
        budget: 1600000000,
        description: "Pembangunan dan perluasan kapasitas ibadah utama serta fasilitas dakwah Masjid At-Taqwa.",
        initializedAt: "2026-05-10T14:30:00Z",
        initializedBy: "Super Admin"
      }
    ];
    saveDBState(state);
  }

  // Ensure milestones array exists to track project milestones
  if (!state.milestones) {
    state.milestones = [
      {
        id: "ms-1",
        title: "Pembersihan Lahan & Pengukuran Konstruksi",
        expectedDate: "2026-05-15",
        category: "Foundation",
        status: "COMPLETED",
        progressNotes: "Lahan telah dibersihkan sepenuhnya dan batas fondasi telah dipasang."
      },
      {
        id: "ms-2",
        title: "Pengecoran Fondasi Cakar Ayam & Sloof Beton",
        expectedDate: "2026-06-25",
        category: "Foundation",
        status: "ON_GOING",
        progressNotes: "Pekerjaan anyaman besi cakar ayam sedang berlangsung."
      },
      {
        id: "ms-3",
        title: "Konstruksi Tiang Kolom Struktur Lantai Satu",
        expectedDate: "2026-08-15",
        category: "Structure",
        status: "PENDING",
        progressNotes: "Persiapan cetakan bekisting tiang kolom."
      },
      {
        id: "ms-4",
        title: "Pemasangan Rangka Baja & Kubah Utama",
        expectedDate: "2026-10-10",
        category: "Roofing",
        status: "PENDING",
        progressNotes: "Pabrikasi kubah di bengkel eksternal."
      },
      {
        id: "ms-5",
        title: "Instalasi Kelistrikan & Plambing Interior (MEP)",
        expectedDate: "2026-11-20",
        category: "MEP",
        status: "PENDING",
        progressNotes: "Menunggu selesainya dinding bata."
      },
      {
        id: "ms-6",
        title: "Finishing Marmer Dinding Mihrab & Lantai Utama",
        expectedDate: "2026-12-25",
        category: "Finishing",
        status: "PENDING",
        progressNotes: "Pemilihan marmer impor telah disetujui panitia."
      }
    ];
    saveDBState(state);
  }

  // Ensure bankAccounts array exists to track bank accounts
  if (!state.bankAccounts) {
    state.bankAccounts = [
      {
        id: "bank-1",
        bankName: "BCA",
        accountNumber: "869-041-2026",
        accountHolder: "PANITIA PEMBANGUNAN UTAMA",
        qrCodeUrl: "",
        isActive: true
      },
      {
        id: "bank-2",
        bankName: "MANDIRI",
        accountNumber: "131-00-2026-0606",
        accountHolder: "REKENING KAS IMAM MASJID",
        qrCodeUrl: "",
        isActive: true
      },
      {
        id: "bank-3",
        bankName: "USDT",
        accountNumber: "TX9z4k1fLzW6v22E54RaUh9435b674b3Pq",
        accountHolder: "TRC20 Wallet Address",
        qrCodeUrl: "",
        isActive: true
      }
    ];
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

// --- PRISMA DATABASE HYBRID INTEGRATION ENGINE ---

function mapToPrismaPaymentMethod(method: string): any {
  if (method === "Bank Transfer" || method === "BANK_TRANSFER") return "BANK_TRANSFER";
  if (method === "E-Wallet" || method === "E_WALLET") return "E_WALLET";
  if (method === "Cash" || method === "CASH") return "CASH";
  if (method === "Crypto" || method === "CRYPTO") return "CRYPTO";
  return "CASH";
}

function mapFromPrismaPaymentMethod(method: string): any {
  if (method === "BANK_TRANSFER") return "Bank Transfer";
  if (method === "E_WALLET") return "E-Wallet";
  if (method === "CASH") return "Cash";
  if (method === "CRYPTO") return "Crypto";
  return method || "Cash";
}

function mapToPrismaExpenditureCategory(cat: string): any {
  if (cat === "Material" || cat === "MATERIAL") return "MATERIAL";
  if (cat === "Labor" || cat === "LABOR") return "LABOR";
  if (cat === "Equipment" || cat === "EQUIPMENT") return "EQUIPMENT";
  if (cat === "Permit/Admin" || cat === "PERMIT_ADMIN") return "PERMIT_ADMIN";
  return "OTHER";
}

function mapFromPrismaExpenditureCategory(cat: string): any {
  if (cat === "MATERIAL") return "Material";
  if (cat === "LABOR") return "Labor";
  if (cat === "EQUIPMENT") return "Equipment";
  if (cat === "PERMIT_ADMIN") return "Permit/Admin";
  return "Other";
}

async function hasActiveProject(): Promise<boolean> {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const count = await prisma.project.count();
      return count > 0;
    } catch {
      return false;
    }
  }
  const db = getDBState();
  return Array.isArray(db.projects) && db.projects.length > 0;
}

async function ensurePostgresBudgets() {
  if (!(await hasActiveProject())) return;
  const prisma = await getPrismaClient();
  if (!prisma) return;
  try {
    const activeProjectId = await getActiveProjectId();
    const count = await prisma.budget.count({
      where: {
        OR: [
          { projectId: activeProjectId },
          activeProjectId === "project-default" ? { projectId: null } : {}
        ]
      }
    });
    if (count === 0) {
      const data = defaultRABBudgets.map(b => ({
        itemName: b.itemName,
        category: b.category,
        targetAmount: b.targetAmount,
        projectId: activeProjectId
      }));
      await prisma.budget.createMany({ data });
    }
  } catch (err) {
    console.error("Prisma ensurePostgresBudgets error", err);
  }
}

async function ensurePostgresUsers() {
  const prisma = await getPrismaClient();
  if (!prisma) return;
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      const usersToSeed = [
        {
          id: "user-admin",
          email: "admin@pintarbangun.vercel.app",
          name: "Rudi P",
          role: "ADMIN" as any,
          password: bcrypt.hashSync("admin", 10)
        },
        {
          id: "user-treasurer",
          email: "bendahara@masjid.id",
          name: "David Miller (Bendahara)",
          role: "TREASURER" as any,
          password: bcrypt.hashSync("treasurer123", 10)
        },
        {
          id: "user-pm",
          email: "pm@masjid.id",
          name: "Arthur Pendelton (PM)",
          role: "PROJECT_MANAGER" as any,
          password: bcrypt.hashSync("pm123", 10)
        }
      ];
      await prisma.user.createMany({ data: usersToSeed });
    }
  } catch (err) {
    console.error("Prisma ensurePostgresUsers error", err);
  }
}

async function findUserByEmail(email: string) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await ensurePostgresUsers();
      const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (u) {
        return {
          id: u.id,
          email: u.email,
          password: u.password,
          name: u.name,
          role: u.role
        };
      }
    } catch (err) {
      console.error("Prisma findUserByEmail failed, falling back", err);
    }
  }
  const db = getDBState();
  return db.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
}

async function createUser(userData: any) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.user.create({
        data: {
          email: userData.email,
          password: userData.password,
          name: userData.name,
          role: userData.role
        }
      });
      return {
        id: created.id,
        email: created.email,
        name: created.name,
        role: created.role
      };
    } catch (err) {
      console.error("Prisma createUser failed, falling back", err);
    }
  }
  const db = getDBState();
  db.users.push(userData);
  saveDBState(db);
  return userData;
}

async function getActiveProjectId(): Promise<string> {
  const config = await getProjectConfigFromDb();
  return config?.id || "project-default";
}

async function getTargetProjectId(req: any): Promise<string> {
  const db = getDBState();
  const visibilityMode = db.visibilityMode || "single";
  if (visibilityMode === "multiple" && req && req.query && req.query.projectId && req.query.projectId !== "undefined") {
    return String(req.query.projectId);
  }
  return await getActiveProjectId();
}

async function getDonations(targetProjectId?: string) {
  if (!(await hasActiveProject())) return [];
  const activeProjectId = targetProjectId || await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const donations = await prisma.donation.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        },
        orderBy: { createdAt: "desc" }
      });
      return donations.map(d => ({
        id: d.id,
        donorName: d.donorName,
        isAnonymous: d.isAnonymous,
        amount: Number(d.amount),
        date: d.date.toISOString(),
        paymentMethod: mapFromPrismaPaymentMethod(d.paymentMethod),
        transferProofUrl: d.transferProofUrl,
        status: d.status
      }));
    } catch (err) {
      console.error("Prisma getDonations failed, falling back", err);
    }
  }
  return (getDBState().donations || []).filter((d: any) => {
    const pid = d.projectId || "project-default";
    return pid === activeProjectId;
  });
}

async function addDonation(donationData: any) {
  const activeProjectId = await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.donation.create({
        data: {
          donorName: donationData.donorName,
          isAnonymous: donationData.isAnonymous,
          amount: donationData.amount,
          paymentMethod: mapToPrismaPaymentMethod(donationData.paymentMethod),
          transferProofUrl: donationData.transferProofUrl,
          status: donationData.status,
          date: new Date(donationData.date),
          projectId: activeProjectId
        }
      });
      return {
        id: created.id,
        donorName: created.donorName,
        isAnonymous: created.isAnonymous,
        amount: Number(created.amount),
        date: created.date.toISOString(),
        paymentMethod: mapFromPrismaPaymentMethod(created.paymentMethod),
        transferProofUrl: created.transferProofUrl,
        status: created.status
      };
    } catch (err) {
      console.error("Prisma addDonation failed, falling back", err);
    }
  }
  const db = getDBState();
  const donationWithProj = { ...donationData, projectId: activeProjectId };
  db.donations.unshift(donationWithProj);
  saveDBState(db);
  return donationWithProj;
}

async function approveDonationInDb(id: string) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const updated = await prisma.donation.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date()
        }
      });
      return {
        id: updated.id,
        donorName: updated.donorName,
        isAnonymous: updated.isAnonymous,
        amount: Number(updated.amount),
        date: updated.date.toISOString(),
        paymentMethod: mapFromPrismaPaymentMethod(updated.paymentMethod),
        transferProofUrl: updated.transferProofUrl,
        status: updated.status
      };
    } catch (err) {
      console.error("Prisma approveDonation failed, falling back", err);
    }
  }
  const db = getDBState();
  const index = db.donations.findIndex((d: any) => d.id === id);
  if (index !== -1) {
    db.donations[index].status = "APPROVED";
    saveDBState(db);
    return db.donations[index];
  }
  return null;
}

async function getExpenditures(targetProjectId?: string) {
  if (!(await hasActiveProject())) return [];
  const activeProjectId = targetProjectId || await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const expenditures = await prisma.expenditure.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        },
        orderBy: { date: "desc" }
      });
      return expenditures.map(e => ({
        id: e.id,
        itemName: e.itemName,
        category: mapFromPrismaExpenditureCategory(e.category),
        volume: Number(e.volume),
        unit: e.unit,
        unitPrice: Number(e.unitPrice),
        totalPrice: Number(e.totalPrice),
        storeName: e.storeName,
        receiptUrl: e.receiptUrl,
        inputtedBy: e.inputtedBy,
        date: e.date.toISOString()
      }));
    } catch (err) {
      console.error("Prisma getExpenditures failed, falling back", err);
    }
  }
  return (getDBState().expenditures || []).filter((e: any) => {
    const pid = e.projectId || "project-default";
    return pid === activeProjectId;
  });
}

async function addExpenditure(expData: any) {
  const activeProjectId = await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.expenditure.create({
        data: {
          itemName: expData.itemName,
          category: mapToPrismaExpenditureCategory(expData.category),
          volume: expData.volume,
          unit: expData.unit,
          unitPrice: expData.unitPrice,
          totalPrice: expData.totalPrice,
          storeName: expData.storeName,
          receiptUrl: expData.receiptUrl,
          inputtedBy: expData.inputtedBy,
          date: new Date(expData.date),
          projectId: activeProjectId
        }
      });
      return {
        id: created.id,
        itemName: created.itemName,
        category: mapFromPrismaExpenditureCategory(created.category),
        volume: Number(created.volume),
        unit: created.unit,
        unitPrice: Number(created.unitPrice),
        totalPrice: Number(created.totalPrice),
        storeName: created.storeName,
        receiptUrl: created.receiptUrl,
        inputtedBy: created.inputtedBy,
        date: created.date.toISOString()
      };
    } catch (err) {
      console.error("Prisma addExpenditure failed, falling back", err);
    }
  }
  const db = getDBState();
  const expWithProj = { ...expData, projectId: activeProjectId };
  db.expenditures.unshift(expWithProj);
  const matchedBudgetIndex = db.budgets.findIndex((b: RABItem) => 
    ((b as any).projectId || "project-default") === activeProjectId && (
      b.category.toLowerCase().startsWith(expData.category.toLowerCase().substring(0,4)) ||
      b.itemName.toLowerCase().includes(expData.itemName.toLowerCase())
    )
  );
  if (matchedBudgetIndex !== -1) {
    db.budgets[matchedBudgetIndex].spentAmount += expData.totalPrice;
  }
  saveDBState(db);
  return expWithProj;
}

async function getBudgets(targetProjectId?: string) {
  if (!(await hasActiveProject())) return [];
  const activeProjectId = targetProjectId || await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await ensurePostgresBudgets();
      const budgets = await prisma.budget.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        }
      });
      const expenditures = await prisma.expenditure.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        }
      });

      return budgets.map(b => {
        const spent = expenditures
          .filter(e => mapFromPrismaExpenditureCategory(e.category).toLowerCase().substring(0,4) === b.category.toLowerCase().substring(0,4) || b.itemName.toLowerCase().includes(e.itemName.toLowerCase()))
          .reduce((sum, e) => sum + Number(e.totalPrice), 0);

        return {
          id: b.id,
          itemName: b.itemName,
          category: b.category as any,
          targetAmount: Number(b.targetAmount),
          spentAmount: spent
        };
      });
    } catch (err) {
      console.error("Prisma getBudgets failed, falling back", err);
    }
  }
  return (getDBState().budgets || []).filter((b: any) => {
    const pid = b.projectId || "project-default";
    return pid === activeProjectId;
  });
}

async function getProgress(targetProjectId?: string) {
  if (!(await hasActiveProject())) return [];
  const activeProjectId = targetProjectId || await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const progress = await prisma.physicalProgress.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        },
        orderBy: { timelineDate: "asc" }
      });
      return progress.map(p => ({
        id: p.id,
        percentage: p.percentage,
        description: p.description,
        timelineDate: p.timelineDate.toISOString(),
        photoUrls: p.photoUrls
      }));
    } catch (err) {
      console.error("Prisma getProgress failed, falling back", err);
    }
  }
  return (getDBState().progress || []).filter((p: any) => {
    const pid = p.projectId || "project-default";
    return pid === activeProjectId;
  });
}

async function addProgress(progressData: any) {
  const activeProjectId = await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.physicalProgress.create({
        data: {
          percentage: progressData.percentage,
          description: progressData.description,
          photoUrls: progressData.photoUrls,
          timelineDate: new Date(progressData.timelineDate),
          projectId: activeProjectId
        }
      });
      return {
        id: created.id,
        percentage: created.percentage,
        description: created.description,
        timelineDate: created.timelineDate.toISOString(),
        photoUrls: created.photoUrls
      };
    } catch (err) {
      console.error("Prisma addProgress failed, falling back", err);
    }
  }
  const db = getDBState();
  const progWithProj = { ...progressData, projectId: activeProjectId };
  db.progress.push(progWithProj);
  saveDBState(db);
  return progWithProj;
}

async function getAuditLogs(targetProjectId?: string) {
  if (!(await hasActiveProject())) return [];
  const activeProjectId = targetProjectId || await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { projectId: activeProjectId },
            activeProjectId === "project-default" ? { projectId: null } : {}
          ]
        },
        orderBy: { timestamp: "desc" }
      });
      return logs.map(l => ({
        id: l.id,
        timestamp: l.timestamp.toISOString(),
        action: l.action as any,
        tableName: l.tableName as any,
        recordId: l.recordId,
        changedBy: l.changedBy,
        details: l.details
      }));
    } catch (err) {
      console.error("Prisma getAuditLogs failed, falling back", err);
    }
  }
  return (getDBState().auditLogs || []).filter((l: any) => {
    const pid = l.projectId || "project-default";
    return pid === activeProjectId;
  });
}

async function addAuditLog(logData: any) {
  const activeProjectId = await getActiveProjectId();
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.auditLog.create({
        data: {
          action: logData.action,
          tableName: logData.tableName,
          recordId: logData.recordId,
          changedBy: logData.changedBy,
          details: logData.details,
          timestamp: new Date(logData.timestamp),
          projectId: activeProjectId
        }
      });
      return;
    } catch (err) {
      console.error("Prisma addAuditLog failed, falling back", err);
    }
  }
  const db = getDBState();
  const logWithProj = { ...logData, projectId: activeProjectId };
  db.auditLogs.unshift(logWithProj);
  saveDBState(db);
}

async function healDatabaseOrphanedProjects() {
  const activeProjectId = await getActiveProjectId();
  if (!activeProjectId || activeProjectId === "project-default") {
    return;
  }

  // Fallback memory state healing
  const db = getDBState();
  let dbChanged = false;
  if (db.donations) {
    db.donations.forEach((d: any) => {
      if (!d.projectId || d.projectId === "project-default") {
        d.projectId = activeProjectId;
        dbChanged = true;
      }
    });
  }
  if (db.expenditures) {
    db.expenditures.forEach((e: any) => {
      if (!e.projectId || e.projectId === "project-default") {
        e.projectId = activeProjectId;
        dbChanged = true;
      }
    });
  }
  if (db.progress) {
    db.progress.forEach((p: any) => {
      if (!p.projectId || p.projectId === "project-default") {
        p.projectId = activeProjectId;
        dbChanged = true;
      }
    });
  }
  if (db.auditLogs) {
    db.auditLogs.forEach((l: any) => {
      if (!l.projectId || l.projectId === "project-default") {
        l.projectId = activeProjectId;
        dbChanged = true;
      }
    });
  }
  if (db.milestones) {
    db.milestones.forEach((m: any) => {
      if (!m.projectId || m.projectId === "project-default") {
        m.projectId = activeProjectId;
        dbChanged = true;
      }
    });
  }
  if (dbChanged) {
    saveDBState(db);
  }

  // Postgres database self-healing
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      // Migrate Donations
      await prisma.donation.updateMany({
        where: {
          OR: [
            { projectId: "project-default" },
            { projectId: null }
          ]
        },
        data: {
          projectId: activeProjectId
        }
      });

      // Migrate Expenditures
      await prisma.expenditure.updateMany({
        where: {
          OR: [
            { projectId: "project-default" },
            { projectId: null }
          ]
        },
        data: {
          projectId: activeProjectId
        }
      });

      // Migrate PhysicalProgress
      await prisma.physicalProgress.updateMany({
        where: {
          OR: [
            { projectId: "project-default" },
            { projectId: null }
          ]
        },
        data: {
          projectId: activeProjectId
        }
      });

      // Migrate AuditLogs
      await prisma.auditLog.updateMany({
        where: {
          OR: [
            { projectId: "project-default" },
            { projectId: null }
          ]
        },
        data: {
          projectId: activeProjectId
        }
      });
    } catch (err) {
      console.error("[HealDB] Error running dynamic db self-healing migration:", err);
    }
  }
}

async function getProjectConfigFromDb(targetProjectId?: string) {
  if (!(await hasActiveProject())) {
    return { initialized: false, name: "", budget: 0, description: "", projectStatus: "belum_mulai" };
  }
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const config = targetProjectId 
        ? await prisma.projectConfig.findUnique({ where: { id: targetProjectId } }).catch(() => null) || await prisma.project.findUnique({ where: { id: targetProjectId } }).catch(() => null)
        : await prisma.projectConfig.findFirst({ orderBy: { updatedAt: "desc" } });
      if (config) {
        return {
          id: config.id,
          name: config.name,
          type: config.type,
          fundingSource: config.fundingSource,
          status: config.status,
          projectStatus: config.projectStatus,
          budget: Number(config.budget),
          description: config.description,
          initialized: true,
          initializedAt: (config as any).initializedAt ? (config as any).initializedAt.toISOString() : new Date().toISOString(),
          initializedBy: (config as any).initializedBy || "Super Admin"
        };
      }
    } catch (err) {
      console.error("Prisma getProjectConfigFromDb failed, falling back", err);
    }
  }
  
  const db = getDBState();
  if (targetProjectId) {
    const found = (db.projects || []).find((p: any) => p.id === targetProjectId);
    if (found) {
      return { ...found, initialized: true };
    }
  }
  return db.projectConfig;
}

async function getProjectsFromDb() {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      let projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" }
      });
      
      if (projects.length === 0) {
        const config = await getProjectConfigFromDb();
        if (config && config.initialized) {
          const seeded = await prisma.project.create({
            data: {
              id: config.id || "project-default",
              name: config.name || "Proyek Utama Pembangunan Masjid At-Taqwa",
              type: config.type || "renovasi",
              fundingSource: config.fundingSource || "donasi",
              status: config.status || "public",
              projectStatus: config.projectStatus || "berjalan",
              budget: Number(config.budget || 1600000000),
              description: config.description || "Pembangunan dan perluasan kapasitas ibadah utama serta fasilitas dakwah Masjid At-Taqwa.",
              initializedBy: config.initializedBy || "Super Admin",
              initializedAt: config.initializedAt ? new Date(config.initializedAt) : new Date()
            }
          });
          projects = [seeded];
          
          // Sync with local memory JSON
          const bk = getDBState();
          if (!bk.projects) bk.projects = [];
          if (bk.projects.length === 0) {
            bk.projects.push({
              id: config.id || "project-default",
              name: config.name || "Proyek Utama Pembangunan Masjid At-Taqwa",
              type: config.type || "renovasi",
              fundingSource: config.fundingSource || "donasi",
              status: config.status || "public",
              projectStatus: config.projectStatus || "berjalan",
              budget: Number(config.budget || 1600000000),
              description: config.description || "Pembangunan dan perluasan kapasitas ibadah utama serta fasilitas dakwah Masjid At-Taqwa.",
              initializedBy: config.initializedBy || "Super Admin",
              initializedAt: config.initializedAt || new Date().toISOString()
            });
            saveDBState(bk);
          }
        }
      }

      return projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        fundingSource: p.fundingSource,
        status: p.status,
        projectStatus: p.projectStatus,
        budget: Number(p.budget),
        description: p.description,
        initializedAt: p.initializedAt ? p.initializedAt.toISOString() : null,
        initializedBy: p.initializedBy
      }));
    } catch (err) {
      console.error("Prisma getProjectsFromDb failed, falling back", err);
    }
  }
  
  const db = getDBState();
  if (db.projectConfig && db.projectConfig.initialized) {
    if (!db.projects || db.projects.length === 0) {
      db.projects = [{
        id: db.projectConfig.id || "project-default",
        name: db.projectConfig.name || "Proyek Utama Pembangunan Masjid At-Taqwa",
        type: db.projectConfig.type || "renovasi",
        fundingSource: db.projectConfig.fundingSource || "donasi",
        status: db.projectConfig.status || "public",
        projectStatus: db.projectConfig.projectStatus || "berjalan",
        budget: Number(db.projectConfig.budget || 1600000000),
        description: db.projectConfig.description || "Pembangunan dan perluasan kapasitas ibadah utama serta fasilitas dakwah Masjid At-Taqwa.",
        initializedBy: db.projectConfig.initializedBy || "Super Admin",
        initializedAt: db.projectConfig.initializedAt || new Date().toISOString()
      }];
      saveDBState(db);
    }
  }
  return db.projects || [];
}

async function getBankAccounts() {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const accounts = await prisma.bankAccount.findMany({
        orderBy: { createdAt: "asc" }
      });
      if (accounts && accounts.length > 0) {
        return accounts.map((a: any) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountHolder: a.accountHolder,
          qrCodeUrl: a.qrCodeUrl || "",
          isActive: a.isActive
        }));
      } else {
        // Safe seeding in Postgres if active but empty
        const defaults = [
          { bankName: "BCA", accountNumber: "869-041-2026", accountHolder: "PANITIA PEMBANGUNAN UTAMA", qrCodeUrl: "", isActive: true },
          { bankName: "MANDIRI", accountNumber: "131-00-2026-0606", accountHolder: "REKENING KAS IMAM MASJID", qrCodeUrl: "", isActive: true },
          { bankName: "USDT", accountNumber: "TX9z4k1fLzW6v22E54RaUh9435b674b3Pq", accountHolder: "TRC20 Wallet Address", qrCodeUrl: "", isActive: true }
        ];
        const seededList = [];
        for (const item of defaults) {
          const created = await prisma.bankAccount.create({ data: item });
          seededList.push({
            id: created.id,
            bankName: created.bankName,
            accountNumber: created.accountNumber,
            accountHolder: created.accountHolder,
            qrCodeUrl: created.qrCodeUrl || "",
            isActive: created.isActive
          });
        }
        return seededList;
      }
    } catch (err) {
      console.error("Prisma getBankAccounts failed, falling back", err);
    }
  }
  return getDBState().bankAccounts || [];
}

async function addBankAccount(bankData: any) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.bankAccount.create({
        data: {
          bankName: bankData.bankName,
          accountNumber: bankData.accountNumber,
          accountHolder: bankData.accountHolder,
          qrCodeUrl: bankData.qrCodeUrl || "",
          isActive: bankData.isActive !== false
        }
      });
      return {
        id: created.id,
        bankName: created.bankName,
        accountNumber: created.accountNumber,
        accountHolder: created.accountHolder,
        qrCodeUrl: created.qrCodeUrl || "",
        isActive: created.isActive
      };
    } catch (err) {
      console.error("Prisma addBankAccount failed, falling back", err);
    }
  }
  const db = getDBState();
  if (!db.bankAccounts) db.bankAccounts = [];
  const newAccount = {
    id: bankData.id || "bank-" + Date.now(),
    bankName: bankData.bankName,
    accountNumber: bankData.accountNumber,
    accountHolder: bankData.accountHolder,
    qrCodeUrl: bankData.qrCodeUrl || "",
    isActive: bankData.isActive !== false
  };
  db.bankAccounts.push(newAccount);
  saveDBState(db);
  return newAccount;
}

async function updateBankAccount(id: string, bankData: any) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const updated = await prisma.bankAccount.update({
        where: { id },
        data: {
          bankName: bankData.bankName,
          accountNumber: bankData.accountNumber,
          accountHolder: bankData.accountHolder,
          qrCodeUrl: bankData.qrCodeUrl || "",
          isActive: bankData.isActive
        }
      });
      return {
        id: updated.id,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        accountHolder: updated.accountHolder,
        qrCodeUrl: updated.qrCodeUrl || "",
        isActive: updated.isActive
      };
    } catch (err) {
      console.error("Prisma updateBankAccount failed, falling back", err);
    }
  }
  const db = getDBState();
  if (!db.bankAccounts) db.bankAccounts = [];
  const idx = db.bankAccounts.findIndex((a: any) => a.id === id);
  if (idx !== -1) {
    db.bankAccounts[idx] = {
      ...db.bankAccounts[idx],
      bankName: bankData.bankName,
      accountNumber: bankData.accountNumber,
      accountHolder: bankData.accountHolder,
      qrCodeUrl: bankData.qrCodeUrl || "",
      isActive: bankData.isActive
    };
    saveDBState(db);
    return db.bankAccounts[idx];
  }
  return null;
}

async function deleteBankAccount(id: string) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.bankAccount.delete({
        where: { id }
      });
      return true;
    } catch (err) {
      console.error("Prisma deleteBankAccount failed, falling back", err);
    }
  }
  const db = getDBState();
  if (!db.bankAccounts) db.bankAccounts = [];
  const lengthBefore = db.bankAccounts.length;
  db.bankAccounts = db.bankAccounts.filter((a: any) => a.id !== id);
  if (db.bankAccounts.length !== lengthBefore) {
    saveDBState(db);
    return true;
  }
  return false;
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
app.post("/api/auth/register", async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "Missing required fields (email, password, name)." });
  }

  const assignedRole = role && ["ADMIN", "TREASURER", "PROJECT_MANAGER"].includes(role) ? role : "TREASURER";

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already registered." });
    }

    const newUser = await createUser({
      id: `user-${Date.now()}`,
      email: email.toLowerCase(),
      password: bcrypt.hashSync(password, 10),
      name,
      role: assignedRole,
      createdAt: new Date().toISOString()
    });

    // Sign token
    const tokenPayload = { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi." });
  }

  try {
    console.log("[LOGIN_DEBUG] Attempting login for email:", email);
    const user = await findUserByEmail(email);
    console.log("[LOGIN_DEBUG] findUserByEmail returned:", user ? { ...user, password: "[HIDDEN]" } : null);

    if (!user) {
      console.log("[LOGIN_DEBUG] User not found");
      return res.status(401).json({ error: "Email atau kata sandi Anda salah." });
    }

    const passwordsMatch = bcrypt.compareSync(password, user.password);
    console.log("[LOGIN_DEBUG] Password match result:", passwordsMatch);

    if (!passwordsMatch) {
      return res.status(401).json({ error: "Email atau kata sandi Anda salah." });
    }

    // Sign token
    const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "24h" });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed." });
  }
});

app.get("/api/auth/me", authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// GET Project configuration
app.get("/api/project-config", async (req, res) => {
  const config = await getProjectConfigFromDb();
  res.json(config || { initialized: false });
});

// GET all projects
app.get("/api/projects", authenticateToken, async (req, res) => {
  const projects = await getProjectsFromDb();
  res.json(projects);
});

// PUT update project by admin
app.put("/api/projects/:id", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;
  const { name, type, fundingSource, status, projectStatus, budget, description } = req.body;

  if (!name || !type || !fundingSource || !status || !projectStatus || !budget || !description) {
    return res.status(400).json({ error: "Semua isian formulir proyek wajib diisi." });
  }

  const db = getDBState();
  if (!db.projects) {
    db.projects = [];
  }

  const projectIndex = db.projects.findIndex((p: any) => p.id === id);
  if (projectIndex === -1 && !process.env.DATABASE_URL) {
    return res.status(404).json({ error: "Proyek tidak ditemukan." });
  }

  const updatedProject: any = {
    id,
    name,
    type,
    fundingSource,
    status,
    projectStatus,
    budget: Number(budget),
    description,
    initializedAt: projectIndex !== -1 ? db.projects[projectIndex].initializedAt : new Date().toISOString(),
    initializedBy: projectIndex !== -1 ? db.projects[projectIndex].initializedBy : "Super Admin"
  };

  if (projectIndex !== -1) {
    db.projects[projectIndex] = updatedProject;
  }

  // If this project is the active project, keep projectConfig in sync!
  if (db.projectConfig && db.projectConfig.id === id) {
    db.projectConfig = {
      ...db.projectConfig,
      name,
      type,
      fundingSource,
      status,
      projectStatus,
      budget: Number(budget),
      description
    };
  }

  // Add an audit log for this update
  const auditUpdate = {
    id: "audit-update-" + Date.now(),
    timestamp: new Date().toISOString(),
    action: "UPDATE" as any,
    tableName: "Budget" as any,
    recordId: id,
    changedBy: req.user.name || req.user.email,
    details: `Admin memperbarui status proyek "${name}" menjadi: ${projectStatus.toUpperCase()}. Anggaran: Rp ${Number(budget).toLocaleString("id-ID")}`
  };
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(auditUpdate);

  saveDBState(db);

  // Prisma Sync (PostgreSQL)
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await prisma.project.upsert({
        where: { id },
        update: {
          name,
          type,
          fundingSource,
          status,
          projectStatus,
          budget: Number(budget),
          description
        },
        create: {
          id,
          name,
          type,
          fundingSource,
          status,
          projectStatus,
          budget: Number(budget),
          description,
          initializedBy: req.user.name || req.user.email
        }
      });

      const activeConfig = await prisma.projectConfig.findFirst({
        orderBy: { updatedAt: "desc" }
      });
      if (activeConfig && activeConfig.id === id) {
        await prisma.projectConfig.update({
          where: { id },
          data: {
            name,
            type,
            fundingSource,
            status,
            projectStatus,
            budget: Number(budget),
            description
          }
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          tableName: "Budget",
          recordId: id,
          changedBy: req.user.name || req.user.email,
          details: `Admin memperbarui status proyek "${name}" menjadi: ${projectStatus.toUpperCase()}. Anggaran: Rp ${Number(budget).toLocaleString("id-ID")}`
        }
      });
    } catch (err) {
      console.error("Prisma update project failed:", err);
    }
  }

  const finalConfig = prisma ? await getProjectConfigFromDb() : db.projectConfig;
  res.json({ success: true, project: updatedProject, projectConfig: finalConfig });
});

// DELETE project by admin
app.delete("/api/projects/:id", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;
  const db = getDBState();

  if (!db.projects) {
    db.projects = [];
  }

  const projectIndex = db.projects.findIndex((p: any) => p.id === id);
  let deletedProjName = "Project";
  
  if (projectIndex !== -1) {
    deletedProjName = db.projects[projectIndex].name;
    db.projects.splice(projectIndex, 1);
  }

  // If the deleted project is the active one, pick the next available or set initialized: false
  if (db.projectConfig && db.projectConfig.id === id) {
    if (db.projects.length > 0) {
      const nextActive = db.projects[0];
      db.projectConfig = {
        ...nextActive,
        initialized: true
      };
    } else {
      db.projectConfig = { initialized: false };
    }
  }

  // Add an audit log for this deletion
  const auditDelete = {
    id: "audit-delete-" + Date.now(),
    timestamp: new Date().toISOString(),
    action: "DELETE" as any,
    tableName: "Budget" as any,
    recordId: id,
    changedBy: req.user.name || req.user.email,
    details: `Admin menghapus proyek "${deletedProjName}".`
  };
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(auditDelete);

  saveDBState(db);

  // Prisma Sync (PostgreSQL)
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      if (deletedProjName === "Project") {
        const found = await prisma.project.findUnique({ where: { id } });
        if (found) deletedProjName = found.name;
      }

      await prisma.project.delete({ where: { id } });
      await prisma.projectConfig.deleteMany({ where: { id } });

      const remaining = await prisma.project.findFirst({
        orderBy: { createdAt: "desc" }
      });

      if (remaining) {
        await prisma.projectConfig.create({
          data: {
            id: remaining.id,
            name: remaining.name,
            type: remaining.type,
            fundingSource: remaining.fundingSource,
            status: remaining.status,
            projectStatus: remaining.projectStatus,
            budget: remaining.budget,
            description: remaining.description,
            initialized: true,
            initializedAt: remaining.initializedAt,
            initializedBy: remaining.initializedBy
          }
        });
      }

      await prisma.auditLog.create({
        data: {
          action: "DELETE",
          tableName: "Budget",
          recordId: id,
          changedBy: req.user.name || req.user.email,
          details: `Admin menghapus proyek "${deletedProjName}".`
        }
      });
    } catch (err) {
      console.error("Prisma delete project failed:", err);
    }
  }

  const finalConfig = prisma ? await getProjectConfigFromDb() : db.projectConfig;
  res.json({ success: true, message: "Proyek berhasil dihapus.", projectConfig: finalConfig });
});

// POST ACTIVATE project by admin
app.post("/api/projects/:id/activate", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;
  const db = getDBState();
  
  try {
    let targetProject: any = null;
    const prisma = await getPrismaClient();
    
    if (prisma) {
      targetProject = await prisma.project.findUnique({
        where: { id }
      });
      if (!targetProject) {
        return res.status(404).json({ error: "Proyek tidak ditemukan di dalam database Postgres." });
      }
      
      // Update or create ProjectConfig in database
      const currentConfig = await prisma.projectConfig.findFirst();
      if (currentConfig) {
        await prisma.projectConfig.update({
          where: { id: currentConfig.id },
          data: {
            id: targetProject.id,
            name: targetProject.name,
            type: targetProject.type,
            fundingSource: targetProject.fundingSource,
            status: targetProject.status,
            projectStatus: targetProject.projectStatus,
            budget: targetProject.budget,
            description: targetProject.description,
            initialized: true,
            initializedAt: targetProject.initializedAt,
            initializedBy: targetProject.initializedBy || "Super Admin"
          }
        });
      } else {
        await prisma.projectConfig.create({
          data: {
            id: targetProject.id,
            name: targetProject.name,
            type: targetProject.type,
            fundingSource: targetProject.fundingSource,
            status: targetProject.status,
            projectStatus: targetProject.projectStatus,
            budget: targetProject.budget,
            description: targetProject.description,
            initialized: true,
            initializedAt: targetProject.initializedAt,
            initializedBy: targetProject.initializedBy || "Super Admin"
          }
        });
      }
      
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          tableName: "Budget",
          recordId: id,
          changedBy: req.user.name || req.user.email,
          details: `Mengaktifkan proyek "${targetProject.name}" sebagai proyek aktif utama.`
        }
      });
    }
    
    // Fallback memory state sync
    if (db.projects) {
      const projMem = db.projects.find((p: any) => p.id === id);
      if (projMem) {
        db.projectConfig = {
          ...projMem,
          initialized: true
        };
      } else if (!prisma) {
        return res.status(404).json({ error: "Proyek tidak ditemukan dalam database." });
      }
    }
    
    // Memory audit log
    const auditObj = {
      id: "audit-activate-" + Date.now(),
      timestamp: new Date().toISOString(),
      action: "UPDATE" as any,
      tableName: "Budget" as any,
      recordId: id,
      changedBy: req.user.name || req.user.email,
      details: `Mengaktifkan proyek "${targetProject?.name || id}" sebagai proyek aktif utama.`
    };
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(auditObj);
    
    saveDBState(db);
    
    const finalConfig = prisma ? await getProjectConfigFromDb() : db.projectConfig;
    res.json({ success: true, message: "Proyek berhasil diaktifkan.", projectConfig: finalConfig });
  } catch (err) {
    console.error("Gagal mengaktifkan proyek:", err);
    res.status(500).json({ error: "Gagal mengaktifkan proyek." });
  }
});

// GET Visibility settings
app.get("/api/visibility-settings", (req, res) => {
  const db = getDBState();
  res.json({
    visibilityMode: db.visibilityMode || "single"
  });
});

// POST Update Visibility settings (Admin only)
app.post("/api/visibility-settings", authenticateToken, requireRole(["ADMIN"]), (req: any, res) => {
  const { visibilityMode } = req.body;
  if (visibilityMode !== "single" && visibilityMode !== "multiple") {
    return res.status(400).json({ error: "Mode visibilitas tidak valid. Harus 'single' atau 'multiple'." });
  }
  const db = getDBState();
  db.visibilityMode = visibilityMode;
  saveDBState(db);
  
  // Also log audit
  const auditSetting = {
    id: "audit-setting-" + Date.now(),
    timestamp: new Date().toISOString(),
    action: "UPDATE" as any,
    tableName: "Budget" as any,
    recordId: "visibility-config",
    changedBy: req.user.name || req.user.email,
    details: `Mengubah mode visibilitas proyek menjadi: "${visibilityMode === "multiple" ? "Multiple Active Projects" : "Single Active Project"}"`
  };
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(auditSetting);
  saveDBState(db);

  res.json({ success: true, message: `Mode visibilitas berhasil diubah ke ${visibilityMode}.` });
});

// GET Backups list (Admin only)
app.get("/api/backups", authenticateToken, requireRole(["ADMIN"]), (req: any, res) => {
  try {
    const db = getDBState();
    res.json(db.backups || []);
  } catch (err) {
    console.error("Get backups error:", err);
    res.status(500).json({ error: "Failed to load backups" });
  }
});

// POST Restore Backup (Admin only)
app.post("/api/backups/:id/restore", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;
  const db = getDBState();
  if (!db.backups) {
    return res.status(400).json({ error: "Tidak ada backup yang tercatat." });
  }
  const backupItem = db.backups.find((b: any) => b.id === id);
  if (!backupItem) {
    return res.status(404).json({ error: "Titik restore tidak ditemukan." });
  }
  
  const backupsDir = path.join(process.cwd(), "backups");
  const filepath = path.join(backupsDir, backupItem.filename);
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: `File backup fisik '${backupItem.filename}' tidak ditemukan di server.` });
  }
  
  try {
    // Read the backup state
    const backupContent = fs.readFileSync(filepath, "utf-8");
    const restoredState = JSON.parse(backupContent);
    
    // Ensure the backups list is preserved so the admin doesn't lose other checkpoints!
    restoredState.backups = db.backups;
    restoredState.visibilityMode = db.visibilityMode || "single";
    
    // Save database state
    saveDBState(restoredState);
    
    // Sync with Postgres (if Prisma is available)
    const prisma = await getPrismaClient();
    if (prisma) {
      try {
        // Drop current configurations in Postgres
        await prisma.donation.deleteMany({});
        await prisma.expenditure.deleteMany({});
        await prisma.physicalProgress.deleteMany({});
        await prisma.auditLog.deleteMany({});
        await prisma.budget.deleteMany({});
        await prisma.projectConfig.deleteMany({});
        await prisma.project.deleteMany({});
        await prisma.user.deleteMany({ where: { role: { in: ["TREASURER", "PROJECT_MANAGER"] } } });

        if (restoredState.projectConfig && restoredState.projectConfig.id) {
          await prisma.projectConfig.create({
            data: {
              id: restoredState.projectConfig.id,
              name: restoredState.projectConfig.name,
              type: restoredState.projectConfig.type,
              fundingSource: restoredState.projectConfig.fundingSource,
              status: restoredState.projectConfig.status,
              projectStatus: restoredState.projectConfig.projectStatus || "berjalan",
              budget: Number(restoredState.projectConfig.budget),
              description: restoredState.projectConfig.description,
              initialized: restoredState.projectConfig.initialized,
              initializedAt: new Date(restoredState.projectConfig.initializedAt),
              initializedBy: restoredState.projectConfig.initializedBy
            }
          });
        }
        
        if (restoredState.projects) {
          for (const proj of restoredState.projects) {
            await prisma.project.create({
              data: {
                id: proj.id,
                name: proj.name,
                type: proj.type,
                fundingSource: proj.fundingSource,
                status: proj.status,
                projectStatus: proj.projectStatus || "berjalan",
                budget: Number(proj.budget),
                description: proj.description,
                initializedAt: new Date(proj.initializedAt),
                initializedBy: proj.initializedBy
              }
            });
          }
        }

        if (restoredState.budgets) {
          await prisma.budget.createMany({
            data: restoredState.budgets.map((b: any) => ({
              id: b.id,
              itemName: b.itemName,
              category: b.category,
              targetAmount: Number(b.targetAmount),
              projectId: b.projectId || "project-default"
            }))
          });
        }

        if (restoredState.donations) {
          await prisma.donation.createMany({
            data: restoredState.donations.map((d: any) => ({
              id: d.id,
              donorName: d.donorName,
              isAnonymous: d.isAnonymous,
              amount: Number(d.amount),
              date: new Date(d.date),
              paymentMethod: (d.paymentMethod === "Bank Transfer" ? "BANK_TRANSFER" : d.paymentMethod === "E-Wallet" ? "E_WALLET" : d.paymentMethod === "Cash" ? "CASH" : "CRYPTO") as any,
              transferProofUrl: d.transferProofUrl,
              status: d.status as any
            }))
          });
        }

        if (restoredState.expenditures) {
          await prisma.expenditure.createMany({
            data: restoredState.expenditures.map((e: any) => ({
              id: e.id,
              itemName: e.itemName,
              category: (e.category === "Material" ? "MATERIAL" : e.category === "Labor" ? "LABOR" : e.category === "Equipment" ? "EQUIPMENT" : e.category === "Permit/Admin" ? "PERMIT_ADMIN" : "OTHER") as any,
              volume: Number(e.volume),
              unit: e.unit,
              unitPrice: Number(e.unitPrice),
              totalPrice: Number(e.totalPrice),
              storeName: e.storeName,
              receiptUrl: e.receiptUrl,
              inputtedBy: e.inputtedBy,
              projectId: e.projectId || "project-default",
              date: new Date(e.date)
            }))
          });
        }

        if (restoredState.progress) {
          await prisma.physicalProgress.createMany({
            data: restoredState.progress.map((p: any) => ({
              id: p.id,
              percentage: Number(p.percentage),
              description: p.description,
              timelineDate: new Date(p.timelineDate),
              photoUrls: p.photoUrls || []
            }))
          });
        }

        if (restoredState.users) {
          const nonAdmins = restoredState.users.filter((u: any) => u.role !== "ADMIN");
          for (const u of nonAdmins) {
            await prisma.user.create({
              data: {
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role,
                password: u.password
              }
            });
          }
        }
      } catch (prismaErr) {
        console.error("Gagal melakukan sync restore point ke Postgres:", prismaErr);
      }
    }
    
    const restoreAudit = {
      id: "audit-restore-" + Date.now(),
      timestamp: new Date().toISOString(),
      action: "UPDATE" as any,
      tableName: "Budget" as any,
      recordId: id,
      changedBy: req.user.name || req.user.email,
      details: `Melakukan restore database kembali ke titik cadangan: "${backupItem.prevProjectName} -> ${backupItem.initializedProjectName}" (Dibuat: ${new Date(backupItem.timestamp).toLocaleString("id-ID")})`
    };
    
    const updatedDb = getDBState();
    if (!updatedDb.auditLogs) updatedDb.auditLogs = [];
    updatedDb.auditLogs.unshift(restoreAudit);
    saveDBState(updatedDb);

    res.json({ success: true, message: `Database berhasil dikembalikan ke titik restore: ${backupItem.prevProjectName} -> ${backupItem.initializedProjectName}` });
  } catch (err) {
    console.error("Restore failed:", err);
    res.status(500).json({ error: "Gagal merestore database dari file cadangan." });
  }
});

// GET Public visible projects (Public page dropdown usage)
app.get("/api/public-projects", async (req, res) => {
  try {
    const projects = await getProjectsFromDb();
    const publicList = projects.filter((p: any) => p.status === "public" || p.status === "PUBLIC" || !p.status);
    res.json(publicList.map((p: any) => ({ id: p.id, name: p.name })));
  } catch (err) {
    console.error("Gagal memuat daftar proyek publik:", err);
    res.status(500).json({ error: "Gagal memuat daftar publik." });
  }
});

function createAutoBackup(db: any, prevProjectName: string, initializedProjectName: string, createdBy: string) {
  try {
    const backupsDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const cleanTimestamp = timestamp.replace(/[:.]/g, "-");
    const filename = `db-backup-${cleanTimestamp}.json`;
    const filepath = path.join(backupsDir, filename);
    
    // Save backup file
    fs.writeFileSync(filepath, JSON.stringify(db, null, 2), "utf-8");
    
    // Add record to backup list
    if (!db.backups) {
      db.backups = [];
    }
    db.backups.push({
      id: "backup-" + Date.now(),
      timestamp,
      prevProjectName: prevProjectName || "Proyek Awal",
      initializedProjectName,
      filename,
      createdBy
    });
    console.log(`Auto Backup created successfully: ${filename}`);
  } catch (error) {
    console.error("Auto Backup creation failed:", error);
  }
}

// POST Project initialization (Admin Only)
app.post("/api/project-config/initialize", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const {
    projectName,
    projectType,
    fundingSource,
    projectStatus,
    budget,
    description,
    treasurerEmail,
    treasurerName,
    treasurerPassword,
    pmEmail,
    pmName,
    pmPassword,
    startFresh
  } = req.body;

  if (
    !projectName ||
    !projectType ||
    !fundingSource ||
    !projectStatus ||
    !budget ||
    !description ||
    !treasurerEmail ||
    !treasurerName ||
    !treasurerPassword ||
    !pmEmail ||
    !pmName ||
    !pmPassword
  ) {
    return res.status(400).json({ error: "Semua isian formulir konfigurasi wajib diisi untuk memulai proyek." });
  }

  try {
    const db = getDBState();
    
    // Auto backup current db state
    createAutoBackup(db, db.projectConfig?.name || "Inisiasi Pertama", projectName, req.user.name || req.user.email);

    const projectId = "project-" + Date.now();

    // 1. Set the main project config
    db.projectConfig = {
      id: projectId,
      name: projectName,
      type: projectType,
      fundingSource,
      status: projectStatus,
      projectStatus: "berjalan",
      budget: Number(budget),
      description,
      initialized: true,
      initializedAt: new Date().toISOString(),
      initializedBy: req.user.name || req.user.email
    };

    // Ensure projects array exists to track projects made by super admin
    if (!db.projects) {
      db.projects = [];
    }

    // 2. Clear old data OR establish new budgets dynamically using percentages if requested
    const rabs = [
      { id: "rab-1-" + Date.now(), itemName: "Pematangan Lahan & Organisasi Fondasi", category: "Foundation" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-2-" + Date.now(), itemName: "Pekerjaan Struktur Kolom & Beton", category: "Structure" as any, targetAmount: Math.round(Number(budget) * 0.30), spentAmount: 0 },
      { id: "rab-3-" + Date.now(), itemName: "Konstruksi Rangka Atap Utama", category: "Roofing" as any, targetAmount: Math.round(Number(budget) * 0.20), spentAmount: 0 },
      { id: "rab-4-" + Date.now(), itemName: "Sistem Utilitas MEP & Kelistrikan/Sanitasi", category: "MEP" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-5-" + Date.now(), itemName: "Finishing Cat, Tegel & Arsitektural", category: "Finishing" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-6-" + Date.now(), itemName: "Legalitas, Perizinan & Biaya Operasional", category: "Operational" as any, targetAmount: Math.round(Number(budget) * 0.05), spentAmount: 0 },
    ];

    const templateMilestones = [
      {
        id: `ms-${Date.now()}-1`,
        title: "Pekerjaan Persiapan & Fondasi",
        expectedDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "Foundation",
        status: "PENDING",
        progressNotes: "Pekerjaan pematangan lahan dan pengecoran fondasi rencana.",
        projectId: projectId
      },
      {
        id: `ms-${Date.now()}-2`,
        title: "Struktur Balok & Tiang Beton",
        expectedDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "Structure",
        status: "PENDING",
        progressNotes: "Pengecoran pilar dan balok utama penopang bangunan.",
        projectId: projectId
      },
      {
        id: `ms-${Date.now()}-3`,
        title: "Pekerjaan Konstruksi Rangka Atap Utama",
        expectedDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "Roofing",
        status: "PENDING",
        progressNotes: "Pemasangan penutup atap atau kubah utama.",
        projectId: projectId
      },
      {
        id: `ms-${Date.now()}-4`,
        title: "Instalasi Mekanikal, Elektrikal & Plambing (MEP)",
        expectedDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "MEP",
        status: "PENDING",
        progressNotes: "Pemasangan pipa air bersih, sanitasi, dan kabel listrik bangunan.",
        projectId: projectId
      },
      {
        id: `ms-${Date.now()}-5`,
        title: "Finishing Marmer, Keramik & Ornamen Arsitektur",
        expectedDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "Finishing",
        status: "PENDING",
        progressNotes: "Finishing cat, pemasangan lantai utama masjid, serta ornamen mihrab.",
        projectId: projectId
      }
    ];

    if (startFresh) {
      db.donations = [];
      db.expenditures = [];
      db.progress = [];
      db.auditLogs = [];
      db.budgets = rabs.map(r => ({ ...r, projectId }));
      db.projects = []; // Clear old projects for a fresh start!
      db.milestones = templateMilestones;
    } else {
      if (!db.budgets) db.budgets = [];
      db.budgets.push(...rabs.map(r => ({ ...r, projectId })));
      if (!db.milestones) db.milestones = [];
      db.milestones.push(...templateMilestones);
    }

    db.projects.push({ ...db.projectConfig });

    // 3. Establish Treasurer and Project Manager users
    // If startFresh is true, we keep only Admin users from old state. 
    // If FALSE, we keep ALL existing users, but filter out anyway if their email conflicts with our new team to prevent bugs.
    let remainingUsers = [];
    if (startFresh) {
      remainingUsers = db.users.filter((user: any) => user.role === "ADMIN");
    } else {
      remainingUsers = db.users.filter((user: any) => 
        user.email !== treasurerEmail.toLowerCase() && 
        user.email !== pmEmail.toLowerCase()
      );
    }

    // Create Treasurer user
    const treasurerUser = {
      id: "user-treasurer-" + Date.now(),
      email: treasurerEmail.toLowerCase(),
      name: treasurerName,
      role: "TREASURER" as any,
      password: bcrypt.hashSync(treasurerPassword, 10),
      createdAt: new Date().toISOString()
    };

    // Create PM user
    const pmUser = {
      id: "user-pm-" + Date.now(),
      email: pmEmail.toLowerCase(),
      name: pmName,
      role: "PROJECT_MANAGER" as any,
      password: bcrypt.hashSync(pmPassword, 10),
      createdAt: new Date().toISOString()
    };

    db.users = [...remainingUsers, treasurerUser, pmUser];

    // Log the audit
    const auditSetup = {
      id: "audit-setup-" + Date.now(),
      timestamp: new Date().toISOString(),
      action: "CREATE" as any,
      tableName: "Budget" as any,
      recordId: "setup-config",
      changedBy: req.user.name || req.user.email,
      details: `Project "${projectName}" initialized. Budget set to Rp ${Number(budget).toLocaleString("id-ID")}. Treasurer & Project Manager users updated.`
    };
    db.auditLogs.unshift(auditSetup);

    // Save state
    saveDBState(db);

    // Dynamic Prisma sync (if Prisma client exists)
    const prisma = await getPrismaClient();
    if (prisma) {
      try {
        if (startFresh) {
          await prisma.donation.deleteMany({});
          await prisma.expenditure.deleteMany({});
          await prisma.physicalProgress.deleteMany({});
          await prisma.auditLog.deleteMany({});
          await prisma.budget.deleteMany({});
          await prisma.projectConfig.deleteMany({});
          await prisma.project.deleteMany({});
          await prisma.user.deleteMany({ where: { role: { in: ["TREASURER", "PROJECT_MANAGER"] } } });
        } else {
          // If not starting fresh, only delete conflicting email records from User table
          await prisma.user.deleteMany({
            where: {
              email: {
                in: [treasurerEmail.toLowerCase(), pmEmail.toLowerCase()]
              }
            }
          });
        }

        // Write Project and Config records in Postgres
        await prisma.projectConfig.create({
          data: {
            id: projectId,
            name: projectName,
            type: projectType,
            fundingSource,
            status: projectStatus,
            projectStatus: "berjalan",
            budget: Number(budget),
            description,
            initialized: true,
            initializedAt: new Date(),
            initializedBy: req.user.name || req.user.email
          }
        });

        await prisma.project.create({
          data: {
            id: projectId,
            name: projectName,
            type: projectType,
            fundingSource,
            status: projectStatus,
            projectStatus: "berjalan",
            budget: Number(budget),
            description,
            initializedAt: new Date(),
            initializedBy: req.user.name || req.user.email
          }
        });

        // Add budgets to Prisma
        const prismaBudgets = rabs.map(b => ({
          itemName: b.itemName,
          category: b.category,
          targetAmount: b.targetAmount,
          projectId: projectId
        }));
        await prisma.budget.createMany({ data: prismaBudgets });

        // Update Users in Prisma (conflict is already handled above)
        await prisma.user.create({
          data: {
            email: treasurerEmail.toLowerCase(),
            name: treasurerName,
            role: "TREASURER" as any,
            password: bcrypt.hashSync(treasurerPassword, 10)
          }
        });
        await prisma.user.create({
          data: {
            email: pmEmail.toLowerCase(),
            name: pmName,
            role: "PROJECT_MANAGER" as any,
            password: bcrypt.hashSync(pmPassword, 10)
          }
        });

        // Add Audit setup to Prisma
        await prisma.auditLog.create({
          data: {
            action: "CREATE",
            tableName: "Budget",
            recordId: "setup-config",
            changedBy: req.user.name || req.user.email,
            details: `Project "${projectName}" initialized. Budget distributed for standard categories.`
          }
        });
      } catch (e) {
        console.error("Prisma config synchronization failed", e);
      }
    }

    // Call dynamic self-healing database migration
    await healDatabaseOrphanedProjects().catch(err => console.error(err));

    const finalConfig = prisma ? await getProjectConfigFromDb() : db.projectConfig;
    res.json({
      success: true,
      message: "Proyek berhasil dikonfigurasi dan disiapkan bersama akun Bendahara & Project Manager baru.",
      projectConfig: finalConfig
    });
  } catch (error: any) {
    console.error("Project initialization error:", error);
    res.status(500).json({ error: "Gagal memproses konfigurasi proyek baru." });
  }
});

// Upload File Endpoint (menerima file upload dan mengembalikan url)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Gagal mengunggah file. Pastikan Anda memilih file yang valid." });
  }

  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  // Cloudinary Integration
  if (cloudinaryUrl) {
    try {
      // Format: cloudinary://api_key:api_secret@cloud_name
      const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
      if (match) {
        const apiKey = match[1];
        const apiSecret = match[2];
        const cloudName = match[3];
        
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true
        });
        console.log("Cloudinary manually configured with cloud_name:", cloudName);
      } else {
        // Fallback to automatic loading
        cloudinary.config();
        console.log("Cloudinary automatic configuration loaded.");
      }
      
      console.log("Mengunggah berkas ke Cloudinary:", req.file.path);
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "smartbuild_uploads",
        resource_type: "auto"
      });
      
      console.log("Berhasil mengunggah ke Cloudinary! URL:", uploadResult.secure_url);

      // Clean up the local temporary file after successful Cloudinary upload
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.warn("Gagal menghapus file lokal sementara:", unlinkErr);
      }

      return res.json({ 
        url: uploadResult.secure_url,
        provider: "cloudinary",
        public_id: uploadResult.public_id
      });
    } catch (cloudinaryErr: any) {
      console.error("Kesalahan fatal saat mengunggah berkas ke Cloudinary:", cloudinaryErr);
      // We will allow local fallback so the user's flow doesn't crash completely, but print error details.
    }
  } else {
    console.warn("CLOUDINARY_URL tidak didefinisikan dalam environment.");
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// 1. Calculations & Summaries (TAMPER-PROOF BALANCE ENGINE)
app.get("/api/financial-summary", async (req, res) => {
  try {
    const targetProjectId = await getTargetProjectId(req);
    await healDatabaseOrphanedProjects();
    const [donations, expenditures, budgets, progress] = await Promise.all([
      getDonations(targetProjectId),
      getExpenditures(targetProjectId),
      getBudgets(targetProjectId),
      getProgress(targetProjectId)
    ]);
    
    // Calculate dynamically from full ledger history to satisfy the tamper-proof formula requirement.
    const approvedDonationsSum = donations
      .filter((d: Donation) => d.status === "APPROVED")
      .reduce((sum: number, d: Donation) => sum + d.amount, 0);

    const expendituresSum = expenditures
      .reduce((sum: number, e: Expenditure) => sum + e.totalPrice, 0);

    const currentCashBalance = approvedDonationsSum - expendituresSum;

    const totalRABTarget = budgets
      .reduce((sum: number, b: RABItem) => sum + b.targetAmount, 0);

    // Get current physical progress percentage (latest logging)
    const currentProgressPercent = progress.length > 0 
      ? progress[progress.length - 1].percentage 
      : 0;

    const db = getDBState();

    res.json({
      totalRaised: approvedDonationsSum,
      totalRABTarget,
      currentCashBalance,
      totalExpenditures: expendituresSum,
      physicalProgressPercent: currentProgressPercent,
      projectConfig: await getProjectConfigFromDb(targetProjectId),
      budgets,
      progress,
      // Add categories analysis for charts
      expendituresByCategory: {
        Material: expenditures.filter((e: any) => e.category === "Material").reduce((s: number, e: any) => s + e.totalPrice, 0),
        Labor: expenditures.filter((e: any) => e.category === "Labor").reduce((s: number, e: any) => s + e.totalPrice, 0),
        Equipment: expenditures.filter((e: any) => e.category === "Equipment").reduce((s: number, e: any) => s + e.totalPrice, 0),
        "Permit/Admin": expenditures.filter((e: any) => e.category === "Permit/Admin").reduce((s: number, e: any) => s + e.totalPrice, 0),
        Other: expenditures.filter((e: any) => e.category === "Other").reduce((s: number, e: any) => s + e.totalPrice, 0)
      },
      donationsByPayment: {
        "Bank Transfer": donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Bank Transfer").reduce((s: number, d: any) => s + d.amount, 0),
        "E-Wallet": donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "E-Wallet").reduce((s: number, d: any) => s + d.amount, 0),
        "Cash": donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Cash").reduce((s: number, d: any) => s + d.amount, 0),
        "Crypto": donations.filter((d: any) => d.status === "APPROVED" && d.paymentMethod === "Crypto").reduce((s: number, d: any) => s + d.amount, 0),
      }
    });
  } catch (error) {
    console.error("Financial summary calculation error:", error);
    res.status(500).json({ error: "Failed to calculate financial summary." });
  }
});

// Bank Accounts Endpoints
app.get("/api/bank-accounts", async (req, res) => {
  try {
    const list = await getBankAccounts();
    res.json(list);
  } catch (err) {
    console.error("GET bank accounts error:", err);
    res.status(500).json({ error: "Gagal mengambil daftar rekening bank." });
  }
});

app.post("/api/bank-accounts", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { bankName, accountNumber, accountHolder, qrCodeUrl, isActive } = req.body;
  if (!bankName || !accountNumber || !accountHolder) {
    return res.status(400).json({ error: "Nama Bank, Nomor Rekening, dan Pemilik Rekening wajib diisi." });
  }

  try {
    const newAccount = await addBankAccount({
      bankName,
      accountNumber,
      accountHolder,
      qrCodeUrl: qrCodeUrl || "",
      isActive: isActive !== false
    });

    // Log the audit
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "CREATE",
      tableName: "BankAccount",
      recordId: newAccount.id,
      changedBy: `${req.user.name} (${req.user.role})`,
      details: `Menambahkan rekening bank baru: ${bankName} - No ${accountNumber} a/n ${accountHolder}`
    });

    res.status(201).json(newAccount);
  } catch (err) {
    console.error("POST bank account error:", err);
    res.status(500).json({ error: "Gagal menambahkan rekening bank." });
  }
});

app.put("/api/bank-accounts/:id", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;
  const { bankName, accountNumber, accountHolder, qrCodeUrl, isActive } = req.body;

  if (!bankName || !accountNumber || !accountHolder) {
    return res.status(400).json({ error: "Nama Bank, Nomor Rekening, dan Pemilik Rekening wajib diisi." });
  }

  try {
    const updated = await updateBankAccount(id, {
      bankName,
      accountNumber,
      accountHolder,
      qrCodeUrl: qrCodeUrl || "",
      isActive: isActive !== false
    });

    if (!updated) {
      return res.status(404).json({ error: "Rekening tidak ditemukan." });
    }

    // Log the audit
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      tableName: "BankAccount",
      recordId: id,
      changedBy: `${req.user.name} (${req.user.role})`,
      details: `Memperbarui rekening bank: ${bankName} - No ${accountNumber} (Aktif: ${isActive ? 'Ya' : 'Tidak'})`
    });

    res.json(updated);
  } catch (err) {
    console.error("PUT bank account error:", err);
    res.status(500).json({ error: "Gagal mengubah rekening bank." });
  }
});

app.delete("/api/bank-accounts/:id", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  const { id } = req.params;

  try {
    const success = await deleteBankAccount(id);
    if (!success) {
      return res.status(404).json({ error: "Rekening tidak ditemukan." });
    }

    // Log the audit
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "DELETE",
      tableName: "BankAccount",
      recordId: id,
      changedBy: `${req.user.name} (${req.user.role})`,
      details: `Menghapus rekening bank dengan ID: ${id}`
    });

    res.json({ message: "Rekening bank berhasil dihapus." });
  } catch (err) {
    console.error("DELETE bank account error:", err);
    res.status(500).json({ error: "Gagal menghapus rekening bank." });
  }
});

// 2. Donations Endpoints
app.get("/api/donations", async (req, res) => {
  try {
    const list = await getDonations();
    res.json(list);
  } catch (err) {
    console.error("GET donations error:", err);
    res.status(500).json({ error: "Failed to retrieve donations." });
  }
});

app.post("/api/donations", async (req, res) => {
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

  const isApproved = approveDirectly ? "APPROVED" : "PENDING";
  const donationId = `don-${Date.now()}`;
  
  const donationData = {
    id: donationId,
    donorName: isAnonymous ? "Anonymous" : donorName,
    isAnonymous: !!isAnonymous,
    amount: Number(amount),
    date: new Date().toISOString(),
    paymentMethod,
    transferProofUrl,
    status: isApproved
  };

  try {
    const savedDonation = await addDonation(donationData);

    // Auto-log audit record
    const auditId = `log-${Date.now()}`;
    const auditData = {
      id: auditId,
      timestamp: new Date().toISOString(),
      action: "CREATE" as const,
      tableName: "Donation" as const,
      recordId: donationId,
      changedBy: approveDirectly ? "Bendahara" : "Publik/Mandiri",
      details: `${isApproved === 'APPROVED' ? 'Disetujui' : 'Tertunda'} Donasi masuk: Rp ${savedDonation.amount.toLocaleString('id-ID')} oleh ${savedDonation.donorName}. Bukti transfer: terverifikasi.`
    };
    
    await addAuditLog(auditData);

    res.status(201).json({ donation: savedDonation, audit: auditData });
  } catch (err) {
    console.error("POST donations error:", err);
    res.status(500).json({ error: "Failed to submit donation." });
  }
});

app.post("/api/donations/:id/approve", authenticateToken, requireRole(["ADMIN", "TREASURER"]), async (req, res) => {
  const { id } = req.params;
  const operator = (req as any).user;

  try {
    const list = await getDonations();
    const donation = list.find((d: Donation) => d.id === id);

    if (!donation) {
      return res.status(404).json({ error: "Donation record not found." });
    }

    if (donation.status === "APPROVED") {
      return res.status(400).json({ error: "Donation is already approved." });
    }

    const updatedDonation = await approveDonationInDb(id);
    if (!updatedDonation) {
      return res.status(500).json({ error: "Failed to approve donation." });
    }

    // Record validation audit trail
    const auditId = `log-${Date.now()}`;
    const auditData = {
      id: auditId,
      timestamp: new Date().toISOString(),
      action: "APPROVE" as const,
      tableName: "Donation" as const,
      recordId: id,
      changedBy: operator.name,
      details: `Menyetujui kontribusi sebesar Rp ${updatedDonation.amount.toLocaleString('id-ID')} dari '${updatedDonation.donorName}'. Bukti transfer terverifikasi oleh ${operator.role}.`
    };

    await addAuditLog(auditData);

    res.json({ donation: updatedDonation, audit: auditData });
  } catch (err) {
    console.error("Approve donation error:", err);
    res.status(500).json({ error: "Failed to approve donation." });
  }
});

// 3. Expenditures Endpoints (Strict validation for invoices)
app.get("/api/expenditures", async (req, res) => {
  try {
    const list = await getExpenditures();
    res.json(list);
  } catch (err) {
    console.error("GET expenditures error:", err);
    res.status(500).json({ error: "Failed to retrieve expenditures." });
  }
});

app.post("/api/expenditures", authenticateToken, requireRole(["ADMIN", "TREASURER"]), async (req, res) => {
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

  const calculatedTotal = Number(volume) * Number(unitPrice);
  const expenditureId = `exp-${Date.now()}`;

  const expenditureData = {
    id: expenditureId,
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

  try {
    const savedExpenditure = await addExpenditure(expenditureData);

    // Audit record creation
    const auditId = `log-${Date.now()}`;
    const auditData = {
      id: auditId,
      timestamp: new Date().toISOString(),
      action: "CREATE" as const,
      tableName: "Expenditure" as const,
      recordId: expenditureId,
      changedBy: operator.name,
      details: `Pembelian ${volume} ${unit} dari '${itemName}' seharga total Rp ${calculatedTotal.toLocaleString('id-ID')} di '${storeName}' diinput oleh ${operator.name} (${operator.role}).`
    };

    await addAuditLog(auditData);

    res.status(201).json({ expenditure: savedExpenditure, audit: auditData });
  } catch (err) {
    console.error("POST expenditure error:", err);
    res.status(500).json({ error: "Failed to record expenditure." });
  }
});

// 4. Physical Progress Endpoints (Project Manager Module)
app.get("/api/progress", async (req, res) => {
  try {
    const list = await getProgress();
    res.json(list);
  } catch (err) {
    console.error("GET progress error:", err);
    res.status(500).json({ error: "Failed to retrieve progress." });
  }
});

app.post("/api/progress", authenticateToken, requireRole(["ADMIN", "PROJECT_MANAGER"]), async (req, res) => {
  const { percentage, description, photoUrl } = req.body;
  const operator = (req as any).user;

  if (percentage === undefined || !description) {
    return res.status(400).json({ error: "Progress percentage (0-100) and descriptions are mandatory." });
  }

  const numericPercent = Number(percentage);
  if (numericPercent < 0 || numericPercent > 100) {
    return res.status(400).json({ error: "Percentage must be an integer between 0 and 100." });
  }

  const progressPhotos = photoUrl && photoUrl.trim() !== "" ? [photoUrl] : [
    "https://images.unsplash.com/photo-1590674899484-13aa0d13301a?w=500&auto=format&fit=crop" // standard placeholder
  ];

  const progressId = `prog-${Date.now()}`;

  const progressData = {
    id: progressId,
    percentage: numericPercent,
    description,
    timelineDate: new Date().toISOString(),
    photoUrls: progressPhotos
  };

  try {
    const savedProgress = await addProgress(progressData);

    // Logging physical progress audit trail
    const auditId = `log-${Date.now()}`;
    const auditData = {
      id: auditId,
      timestamp: new Date().toISOString(),
      action: "CREATE" as const,
      tableName: "PhysicalProgress" as const,
      recordId: progressId,
      changedBy: operator.name,
      details: `Kemajuan fisik proyek diperbarui ke ${numericPercent}% oleh ${operator.name} (${operator.role}). Keterangan: ${description}`
    };

    await addAuditLog(auditData);

    res.status(201).json({ progress: savedProgress, audit: auditData });
  } catch (err) {
    console.error("POST progress error:", err);
    res.status(500).json({ error: "Failed to post progress update." });
  }
});

// 5. Audit logs endpoint
app.get("/api/audit-logs", async (req, res) => {
  try {
    const list = await getAuditLogs();
    res.json(list);
  } catch (err) {
    console.error("GET audit logs error:", err);
    res.status(500).json({ error: "Failed to retrieve audit logs." });
  }
});

app.post("/api/audit-logs", authenticateToken, async (req, res) => {
  const { action, tableName, recordId, details } = req.body;
  const operator = (req as any).user;
  const auditId = `log-${Date.now()}`;
  const auditData = {
    id: auditId,
    timestamp: new Date().toISOString(),
    action: action || "CREATE",
    tableName: tableName || "Budget",
    recordId: recordId || "system",
    changedBy: operator.name || "System",
    details: details || "Action executed."
  };
  try {
    const savedLog = await addAuditLog(auditData);
    res.status(201).json(savedLog);
  } catch (err) {
    console.error("POST audit log error:", err);
    res.status(500).json({ error: "Failed to record audit log." });
  }
});

// 5.5 Export full database to JSON/CSV (Admin only)
app.get("/api/export-database", authenticateToken, requireRole(["ADMIN"]), async (req: any, res) => {
  try {
    const prisma = await getPrismaClient();
    
    let configs = [];
    let projects = [];
    let users = [];
    let donations = [];
    let expenditures = [];
    let budgets = [];
    let physicalProgress = [];
    let auditLogs = [];

    if (process.env.DATABASE_URL) {
      configs = await prisma.projectConfig.findMany();
      projects = await prisma.project.findMany();
      users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true, createdAt: true }
      });
      donations = await prisma.donation.findMany();
      expenditures = await prisma.expenditure.findMany();
      budgets = await prisma.budget.findMany();
      physicalProgress = await prisma.physicalProgress.findMany();
      auditLogs = await prisma.auditLog.findMany();
    } else {
      const db = getDBState();
      configs = db.projectConfig ? [db.projectConfig] : [];
      projects = db.projects || [];
      users = (db.users || []).map((u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role }));
      donations = db.donations || [];
      expenditures = db.expenditures || [];
      budgets = db.budgets || [];
      physicalProgress = db.physicalProgress || [];
      auditLogs = db.auditLogs || [];
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.name || req.user.email,
      databaseType: process.env.DATABASE_URL ? "Production Database" : "In-Memory Sandbox",
      data: {
        configs,
        projects,
        users,
        donations,
        expenditures,
        budgets,
        physicalProgress,
        auditLogs
      }
    };

    res.setHeader("Content-Disposition", "attachment; filename=smartbuild_backup.json");
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  } catch (err) {
    console.error("GET export database error:", err);
    res.status(500).json({ error: "Failed to export project database. Please try again later." });
  }
});

// 6. Dynamic System Info Endpoint
app.get("/api/system-info", (req, res) => {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    res.json({
      version: packageJson.version || "2.0.0",
      year: new Date().getFullYear()
    });
  } catch (err) {
    res.json({
      version: "2.0.0",
      year: new Date().getFullYear()
    });
  }
});

// 6b. Google Drive Proxy Endpoint for delivering images without iframe/CORS cookie restrictions
app.get("/api/drive-proxy", async (req, res) => {
  const fileId = req.query.id as string;
  if (!fileId) {
    return res.status(400).json({ error: "Missing Google Drive file ID." });
  }

  const authHeader = req.headers.authorization;
  
  try {
    let driveRes;
    
    // 1. Try using official Google Drive Files API first if access token/Authorization is provided
    if (authHeader) {
      driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: authHeader
        }
      });
    }

    // 2. Fallback to public thumbnail delivery endpoint which is bypass-safe and serves the full/high-res version with sz=w1600
    if (!driveRes || !driveRes.ok) {
      driveRes = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`);
    }

    if (driveRes.ok && driveRes.body) {
      const contentType = driveRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      const buffer = await driveRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      res.status(driveRes ? driveRes.status : 500).json({ error: "Gagal memuat berkas dari Google Drive." });
    }
  } catch (error) {
    console.error("Error proxying Google Drive file:", error);
    res.status(500).json({ error: "Kesalahan internal saat memuat berkas dari Google Drive." });
  }
});

// 6. Project Milestone Timeline Endpoints
app.get("/api/milestones", async (req, res) => {
  try {
    const db = getDBState();
    if (!db.milestones) {
      db.milestones = [];
      saveDBState(db);
    }
    const activeProjectId = await getTargetProjectId(req);
    const filtered = db.milestones.filter((m: any) => {
      const pid = m.projectId || "project-default";
      return pid === activeProjectId;
    });
    res.json(filtered);
  } catch (err) {
    console.error("GET milestones error:", err);
    res.status(500).json({ error: "Gagal memuat daftar milestones." });
  }
});

app.post("/api/milestones", authenticateToken, requireRole(["ADMIN", "PROJECT_MANAGER"]), async (req, res) => {
  const { title, expectedDate, category, status, progressNotes } = req.body;
  const operator = (req as any).user;

  if (!title || !expectedDate || !category || !status) {
    return res.status(400).json({ error: "Judul milestone, estimasi tanggal selesai, kategori, dan status wajib diisi." });
  }

  try {
    const db = getDBState();
    if (!db.milestones) {
      db.milestones = [];
    }

    const activeProjectId = await getActiveProjectId();
    const milestoneId = `ms-${Date.now()}`;
    const newMilestone = {
      id: milestoneId,
      title,
      expectedDate,
      category,
      status,
      progressNotes: progressNotes || "",
      projectId: activeProjectId
    };

    db.milestones.push(newMilestone);
    saveDBState(db);

    // Audit Logging
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "CREATE",
      tableName: "Budget" as const, // matching existing types
      recordId: milestoneId,
      changedBy: operator.name,
      details: `Milestone baru dibuat: "${title}" (${category}), estimasi tanggal selesai: ${expectedDate}.`
    });

    res.status(201).json(newMilestone);
  } catch (err) {
    console.error("POST milestones error:", err);
    res.status(500).json({ error: "Gagal membuat milestone baru." });
  }
});

app.put("/api/milestones/:id", authenticateToken, requireRole(["ADMIN", "PROJECT_MANAGER"]), async (req, res) => {
  const { id } = req.params;
  const { title, expectedDate, category, status, progressNotes } = req.body;
  const operator = (req as any).user;

  try {
    const db = getDBState();
    if (!db.milestones) {
      db.milestones = [];
    }

    const index = db.milestones.findIndex((m: any) => m.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Milestone tidak ditemukan." });
    }

    const old = db.milestones[index];
    const updatedMilestone = {
      ...old,
      title: title !== undefined ? title : old.title,
      expectedDate: expectedDate !== undefined ? expectedDate : old.expectedDate,
      category: category !== undefined ? category : old.category,
      status: status !== undefined ? status : old.status,
      progressNotes: progressNotes !== undefined ? progressNotes : old.progressNotes
    };

    db.milestones[index] = updatedMilestone;
    saveDBState(db);

    // Audit Logging
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      tableName: "Budget" as const,
      recordId: id,
      changedBy: operator.name,
      details: `Milestone "${updatedMilestone.title}" diperbarui oleh ${operator.name}. Status: ${updatedMilestone.status}.`
    });

    res.json(updatedMilestone);
  } catch (err) {
    console.error("PUT milestones error:", err);
    res.status(500).json({ error: "Gagal memperbarui milestone." });
  }
});

app.delete("/api/milestones/:id", authenticateToken, requireRole(["ADMIN", "PROJECT_MANAGER"]), async (req, res) => {
  const { id } = req.params;
  const operator = (req as any).user;

  try {
    const db = getDBState();
    if (!db.milestones) {
      db.milestones = [];
    }

    const index = db.milestones.findIndex((m: any) => m.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Milestone tidak ditemukan." });
    }

    const milestoneTitle = db.milestones[index].title;
    db.milestones.splice(index, 1);
    saveDBState(db);

    // Audit Logging
    await addAuditLog({
      timestamp: new Date().toISOString(),
      action: "DELETE",
      tableName: "Budget" as const,
      recordId: id,
      changedBy: operator.name,
      details: `Milestone "${milestoneTitle}" dihapus oleh ${operator.name}.`
    });

    res.json({ message: "Milestone berhasil dihapus." });
  } catch (err) {
    console.error("DELETE milestones error:", err);
    res.status(500).json({ error: "Gagal menghapus milestone." });
  }
});

// 7. Google OAuth Callback Route
app.get(["/oauth-callback", "/oauth-callback/"], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Autentikasi Google Berhasil</title>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            text-align: center;
            padding: 50px 20px;
            background-color: #f8fafc;
            color: #0f172a;
          }
          .card {
            background: white;
            padding: 30px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            max-width: 400px;
            margin: 0 auto;
            border: 1px solid #e2e8f0;
          }
          .icon {
            font-size: 48px;
            margin-bottom: 20px;
            color: #10b981;
          }
          h2 {
            margin-bottom: 8px;
            color: #10b981;
          }
          p {
            font-size: 14px;
            color: #64748b;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Autentikasi Berhasil!</h2>
          <p>Koneksi ke akun Google Anda telah terverifikasi. Halaman ini akan menutup secara otomatis...</p>
        </div>
        <script>
          const hash = window.location.hash;
          if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            if (accessToken && window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', accessToken }, '*');
            }
          }
          setTimeout(() => {
            window.close();
          }, 1500);
        </script>
      </body>
    </html>
  `);
});

// Setup development devServer or production asset pipelines
async function startServer() {
  // Run self-healing database migration for any pre-existing/orphaned default data
  await healDatabaseOrphanedProjects().catch(err => console.error("Startup HealDB error:", err));

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

if (!process.env.VERCEL) {
  startServer();
}
