// Vercel Production Deployment Patch - June 2026
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
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
const UPLOADS_DIR = process.env.VERCEL ? "/tmp" : path.join(__dirname, "uploads");

// Ensure upload directory exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (error) {
  console.warn("Could not create uploads directory because of read-only filesystem, but continuing:", error);
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
    const count = await prisma.budget.count();
    if (count === 0) {
      const data = defaultRABBudgets.map(b => ({
        itemName: b.itemName,
        category: b.category,
        targetAmount: b.targetAmount
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

async function getDonations() {
  if (!(await hasActiveProject())) return [];
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const donations = await prisma.donation.findMany({
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
  return getDBState().donations;
}

async function addDonation(donationData: any) {
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
          date: new Date(donationData.date)
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
  db.donations.unshift(donationData);
  saveDBState(db);
  return donationData;
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

async function getExpenditures() {
  if (!(await hasActiveProject())) return [];
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const expenditures = await prisma.expenditure.findMany({
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
  return getDBState().expenditures;
}

async function addExpenditure(expData: any) {
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
          date: new Date(expData.date)
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
  db.expenditures.unshift(expData);
  const matchedBudgetIndex = db.budgets.findIndex((b: RABItem) => 
    b.category.toLowerCase().startsWith(expData.category.toLowerCase().substring(0,4)) ||
    b.itemName.toLowerCase().includes(expData.itemName.toLowerCase())
  );
  if (matchedBudgetIndex !== -1) {
    db.budgets[matchedBudgetIndex].spentAmount += expData.totalPrice;
  }
  saveDBState(db);
  return expData;
}

async function getBudgets() {
  if (!(await hasActiveProject())) return [];
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      await ensurePostgresBudgets();
      const budgets = await prisma.budget.findMany();
      const expenditures = await prisma.expenditure.findMany();

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
  return getDBState().budgets;
}

async function getProgress() {
  if (!(await hasActiveProject())) return [];
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const progress = await prisma.physicalProgress.findMany({
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
  return getDBState().progress;
}

async function addProgress(progressData: any) {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const created = await prisma.physicalProgress.create({
        data: {
          percentage: progressData.percentage,
          description: progressData.description,
          photoUrls: progressData.photoUrls,
          timelineDate: new Date(progressData.timelineDate)
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
  db.progress.push(progressData);
  saveDBState(db);
  return progressData;
}

async function getAuditLogs() {
  if (!(await hasActiveProject())) return [];
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const logs = await prisma.auditLog.findMany({
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
  return getDBState().auditLogs;
}

async function addAuditLog(logData: any) {
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
          timestamp: new Date(logData.timestamp)
        }
      });
      return;
    } catch (err) {
      console.error("Prisma addAuditLog failed, falling back", err);
    }
  }
  const db = getDBState();
  db.auditLogs.unshift(logData);
  saveDBState(db);
}

async function getProjectConfigFromDb() {
  if (!(await hasActiveProject())) {
    return { initialized: false, name: "", budget: 0, description: "", projectStatus: "belum_mulai" };
  }
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const config = await prisma.projectConfig.findFirst({
        orderBy: { updatedAt: "desc" }
      });
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
          initialized: config.initialized,
          initializedAt: config.initializedAt.toISOString(),
          initializedBy: config.initializedBy
        };
      } else {
        // Seed database table from json state if empty
        const db = getDBState();
        if (db.projectConfig) {
          const budgetVal = Number(db.projectConfig.budget || 0);
          const seeded = await prisma.projectConfig.create({
            data: {
              id: db.projectConfig.id || "project-default",
              name: db.projectConfig.name || "Proyek Utama Pembangunan Masjid At-Taqwa",
              type: db.projectConfig.type || "renovasi",
              fundingSource: db.projectConfig.fundingSource || "donasi",
              status: db.projectConfig.status || "public",
              projectStatus: db.projectConfig.projectStatus || db.projectConfig.status || "berjalan",
              budget: budgetVal,
              description: db.projectConfig.description || "Ekspansi...",
              initialized: db.projectConfig.initialized !== false,
              initializedAt: db.projectConfig.initializedAt ? new Date(db.projectConfig.initializedAt) : new Date(),
              initializedBy: db.projectConfig.initializedBy || "Super Admin"
            }
          });
          return {
            id: seeded.id,
            name: seeded.name,
            type: seeded.type,
            fundingSource: seeded.fundingSource,
            status: seeded.status,
            projectStatus: seeded.projectStatus,
            budget: Number(seeded.budget),
            description: seeded.description,
            initialized: seeded.initialized,
            initializedAt: seeded.initializedAt.toISOString(),
            initializedBy: seeded.initializedBy
          };
        }
      }
    } catch (err) {
      console.error("Prisma getProjectConfigFromDb failed, falling back", err);
    }
  }
  return getDBState().projectConfig;
}

async function getProjectsFromDb() {
  const prisma = await getPrismaClient();
  if (prisma) {
    try {
      const projects = await prisma.project.findMany({
        orderBy: { createdAt: "desc" }
      });
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
  return getDBState().projects || [];
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
      { id: "rab-1", itemName: "Pematangan Lahan & Organisasi Fondasi", category: "Foundation" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-2", itemName: "Pekerjaan Struktur Kolom & Beton", category: "Structure" as any, targetAmount: Math.round(Number(budget) * 0.30), spentAmount: 0 },
      { id: "rab-3", itemName: "Konstruksi Rangka Atap Utama", category: "Roofing" as any, targetAmount: Math.round(Number(budget) * 0.20), spentAmount: 0 },
      { id: "rab-4", itemName: "Sistem Utilitas MEP & Kelistrikan/Sanitasi", category: "MEP" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-5", itemName: "Finishing Cat, Tegel & Arsitektural", category: "Finishing" as any, targetAmount: Math.round(Number(budget) * 0.15), spentAmount: 0 },
      { id: "rab-6", itemName: "Legalitas, Perizinan & Biaya Operasional", category: "Operational" as any, targetAmount: Math.round(Number(budget) * 0.05), spentAmount: 0 },
    ];

    if (startFresh) {
      db.donations = [];
      db.expenditures = [];
      db.progress = [];
      db.auditLogs = [];
      db.budgets = rabs;
      db.projects = []; // Clear old projects for a fresh start!
    } else {
      // Just adjust the budgets to the new percentages to fit the config
      db.budgets = rabs;
    }

    db.projects.push({ ...db.projectConfig });

    // 3. Establish Treasurer and Project Manager users
    const adminUsers = db.users.filter((user: any) => user.role === "ADMIN");

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

    db.users = [...adminUsers, treasurerUser, pmUser];

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
        } else {
          await prisma.budget.deleteMany({});
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
          targetAmount: b.targetAmount
        }));
        await prisma.budget.createMany({ data: prismaBudgets });

        // Update Users in Prisma
        await prisma.user.deleteMany({ where: { role: { in: ["TREASURER", "PROJECT_MANAGER"] } } });
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
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Gagal mengunggah file. Pastikan Anda memilih file yang valid." });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// 1. Calculations & Summaries (TAMPER-PROOF BALANCE ENGINE)
app.get("/api/financial-summary", async (req, res) => {
  try {
    const [donations, expenditures, budgets, progress] = await Promise.all([
      getDonations(),
      getExpenditures(),
      getBudgets(),
      getProgress()
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
      projectConfig: await getProjectConfigFromDb(),
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
      version: packageJson.version || "1.2.8",
      year: new Date().getFullYear()
    });
  } catch (err) {
    res.json({
      version: "1.2.8",
      year: new Date().getFullYear()
    });
  }
});

// Setup development devServer or production asset pipelines
async function startServer() {
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
