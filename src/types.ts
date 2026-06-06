export type UserRole = 'ADMIN' | 'TREASURER' | 'PROJECT_MANAGER' | 'PUBLIC';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'TREASURER' | 'PROJECT_MANAGER';
  createdAt?: string;
}

export interface RABItem {
  id: string;
  itemName: string;
  category: 'Foundation' | 'Structure' | 'Roofing' | 'Finishing' | 'MEP' | 'Operational';
  targetAmount: number;
  spentAmount: number;
}

export interface Donation {
  id: string;
  donorName: string;
  isAnonymous: boolean;
  amount: number;
  date: string;
  paymentMethod: 'Bank Transfer' | 'E-Wallet' | 'Cash' | 'Crypto';
  transferProofUrl: string;
  status: 'PENDING' | 'APPROVED';
}

export interface Expenditure {
  id: string;
  itemName: string;
  category: 'Material' | 'Labor' | 'Equipment' | 'Permit/Admin' | 'Other';
  volume: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  storeName: string;
  receiptUrl: string;
  inputtedBy: string;
  date: string;
}

export interface PhysicalProgress {
  id: string;
  percentage: number;
  description: string;
  timelineDate: string;
  photoUrls: string[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE';
  tableName: 'Donation' | 'Expenditure' | 'PhysicalProgress' | 'Budget';
  recordId: string;
  changedBy: string;
  details: string; // readable summary of change
}

export interface Milestone {
  id: string;
  title: string;
  expectedDate: string;
  category: 'Foundation' | 'Structure' | 'Roofing' | 'Finishing' | 'MEP' | 'Operational' | 'Other';
  status: 'PENDING' | 'ON_GOING' | 'COMPLETED';
  progressNotes?: string;
}

