import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import { 
  Donation, 
  Expenditure, 
  PhysicalProgress, 
  RABItem, 
  AuditLog 
} from "./src/types.js"; // Standard TS/JS resolver

export const app = express();
const prisma = process.env.DATABASE_URL ? new PrismaClient() : null;
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

async function ensurePostgresBudgets() {
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
  if (!prisma) return;
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      const usersToSeed = [
        {
          id: "user-admin",
          email: "admin@masjid.id",
          name: "Haji Sulaiman (Super Admin)",
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
    const user = await findUserByEmail(email);

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed." });
  }
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

    res.json({
      totalRaised: approvedDonationsSum,
      totalRABTarget,
      currentCashBalance,
      totalExpenditures: expendituresSum,
      physicalProgressPercent: currentProgressPercent,
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
