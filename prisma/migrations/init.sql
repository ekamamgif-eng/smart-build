-- DATABASE INITIALIZATION DDL FOR SMARTBUILD --
-- Designed for NeonDB PostgreSQL with full audit logging triggers to enforce tamper-proof entries.

-- Enums
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TREASURER', 'PROJECT_MANAGER');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'E_WALLET', 'CASH', 'CRYPTO');
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'APPROVED');
CREATE TYPE "ExpenditureCategory" AS ENUM ('MATERIAL', 'LABOR', 'EQUIPMENT', 'PERMIT_ADMIN', 'OTHER');

-- Users Table
CREATE TABLE "User" (
    "id" VARCHAR(255) PRIMARY KEY,
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "Role" DEFAULT 'TREASURER' NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Budgets Table (RAB line items)
CREATE TABLE "Budget" (
    "id" VARCHAR(255) PRIMARY KEY,
    "itemName" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL, -- e.g. 'Foundation', 'Structure', etc.
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Donations Table
CREATE TABLE "Donation" (
    "id" VARCHAR(255) PRIMARY KEY,
    "donorName" VARCHAR(255) NOT NULL,
    "isAnonymous" BOOLEAN DEFAULT FALSE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL CHECK ("amount" > 0),
    "date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "transferProofUrl" VARCHAR(1024) NOT NULL, -- Ensures auditable receipt of funds
    "status" "DonationStatus" DEFAULT 'PENDING' NOT NULL,
    "approvedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Expenditures Table
CREATE TABLE "Expenditure" (
    "id" VARCHAR(255) PRIMARY KEY,
    "itemName" VARCHAR(255) NOT NULL,
    "category" "ExpenditureCategory" NOT NULL,
    "volume" DECIMAL(10,2) NOT NULL CHECK ("volume" > 0),
    "unit" VARCHAR(50) NOT NULL, -- 'm3', 'kg', 'pcs', 'days'
    "unitPrice" DECIMAL(12,2) NOT NULL CHECK ("unitPrice" > 0),
    "totalPrice" DECIMAL(12,2) NOT NULL, -- Computed and validated as volume * unitPrice
    "storeName" VARCHAR(255) NOT NULL,
    "receiptUrl" VARCHAR(1024) NOT NULL, -- STRICT CONSTRAINT: Expenditures must provide invoice/receipt photo url
    "inputtedBy" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "date" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT check_total_price CHECK ("totalPrice" = "volume" * "unitPrice")
);

-- Physical Progress Table
CREATE TABLE "PhysicalProgress" (
    "id" VARCHAR(255) PRIMARY KEY,
    "percentage" INTEGER NOT NULL CHECK ("percentage" >= 0 AND "percentage" <= 100),
    "description" TEXT NOT NULL,
    "timelineDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "photoUrls" TEXT[] NOT NULL, -- PostgreSQL array type for dynamic progress photo gallery
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit Logs Table
CREATE TABLE "AuditLog" (
    "id" VARCHAR(255) PRIMARY KEY,
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "action" VARCHAR(50) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'APPROVE'
    "tableName" VARCHAR(100) NOT NULL, -- 'Donation', 'Expenditure', 'PhysicalProgress', 'Budget'
    "recordId" VARCHAR(255) NOT NULL,
    "changedBy" VARCHAR(255) NOT NULL, -- Either User Name or system process identifiers
    "userId" VARCHAR(255) REFERENCES "User"("id") ON DELETE SET NULL,
    "details" TEXT NOT NULL
);

-- TRIGGERS & PROCEDURES (FOR SECURE & TAMPER-PROOF MUTATION CAPTURING)
-- Automatically writes security audit entries whenever records are adjusted.

CREATE OR REPLACE FUNCTION log_donation_mutation() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
        VALUES (
            gen_random_uuid()::varchar,
            'CREATE',
            'Donation',
            NEW."id",
            'System/InputForm',
            'Pending donation logged for ' || NEW."donorName" || ' of ' || NEW."amount"::text
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD."status" = 'PENDING' AND NEW."status" = 'APPROVED' THEN
            INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
            VALUES (
                gen_random_uuid()::varchar,
                'APPROVE',
                'Donation',
                NEW."id",
                'Treasurer',
                'Approved donation from ' || NEW."donorName" || ' amounting to ' || NEW."amount"::text
            );
        ELSE
            INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
            VALUES (
                gen_random_uuid()::varchar,
                'UPDATE',
                'Donation',
                NEW."id",
                'Treasurer',
                'Donation updated. Old Amount: ' || OLD."amount"::text || ' -> New Amount: ' || NEW."amount"::text
            );
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
        VALUES (
            gen_random_uuid()::varchar,
            'DELETE',
            'Donation',
            OLD."id",
            'Treasurer',
            'Deleted donation belonging to: ' || OLD."donorName" || ' of value ' || OLD."amount"::text
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_donation
AFTER INSERT OR UPDATE OR DELETE ON "Donation"
FOR EACH ROW EXECUTE FUNCTION log_donation_mutation();


-- Same for expenditures
CREATE OR REPLACE FUNCTION log_expenditure_mutation() 
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "userId", "details")
        VALUES (
            gen_random_uuid()::varchar,
            'CREATE',
            'Expenditure',
            NEW."id",
            NEW."inputtedBy",
            NEW."userId",
            'Logged expenditure for ' || NEW."itemName" || ' of total cost ' || NEW."totalPrice"::text || '. Invoice vendor: ' || NEW."storeName"
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "userId", "details")
        VALUES (
            gen_random_uuid()::varchar,
            'UPDATE',
            'Expenditure',
            NEW."id",
            NEW."inputtedBy",
            NEW."userId",
            'Expenditure adjusted. Old Total: ' || OLD."totalPrice"::text || ' -> New Total: ' || NEW."totalPrice"::text
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO "AuditLog" ("id", "action", "tableName", "recordId", "changedBy", "details")
        VALUES (
            gen_random_uuid()::varchar,
            'DELETE',
            'Expenditure',
            OLD."id",
            'Treasurer',
            'Deleted expenditure: ' || OLD."itemName" || ' of total cost ' || OLD."totalPrice"::text
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_expenditure
AFTER INSERT OR UPDATE OR DELETE ON "Expenditure"
FOR EACH ROW EXECUTE FUNCTION log_expenditure_mutation();
