// @ts-nocheck
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Starting database seeding...");

  const usersToSeed = [
    {
      email: "admin@masjid.id",
      name: "Rudi P",
      role: Role.ADMIN,
      passwordRaw: "admin"
    },
    {
      email: "bendahara@masjid.id",
      name: "Haji Rosyid (Bendahara)",
      role: Role.TREASURER,
      passwordRaw: "treasurer123"
    },
    {
      email: "pm@masjid.id",
      name: "Ir. Hermawan (Project Manager)",
      role: Role.PROJECT_MANAGER,
      passwordRaw: "pm123"
    }
  ];

  for (const user of usersToSeed) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email }
    });

    if (existing) {
      console.log(`⚠️ User ${user.email} already exists.`);
      continue;
    }

    // Hash securely
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.passwordRaw, salt);

    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: hashedPassword
      }
    });

    console.log(`✅ Seeded account: ${user.name} (${user.role})`);
  }

  console.log("🚀 =================================================");
  console.log("🎯 ALL SEEDS ACCOMPLISHED SUCCESSFULLY!");
  console.log("🚀 =================================================");
}

main()
  .catch((e) => {
    console.error("❌ Error running seed script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
