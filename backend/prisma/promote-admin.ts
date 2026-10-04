import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Usage: npm run crm:promote-admin -- <existing-verified-user-email>");
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!user) {
    throw new Error("No account exists for this email. Sign in to the storefront once, then promote the account.");
  }
  if (user.role === "ADMIN") {
    console.log("This account already has CRM administrator access.");
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log("CRM administrator access granted.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unable to grant CRM administrator access");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
