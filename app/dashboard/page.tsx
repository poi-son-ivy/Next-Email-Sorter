import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  // Fetch user with their connected accounts, categories, and emails
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      accounts: {
        where: {
          provider: "google",
        },
      },
      categories: {
        orderBy: {
          createdAt: "asc",
        },
      },
      emails: {
        orderBy: {
          receivedAt: "desc",
        },
        take: 50, // Show last 50 emails
        include: {
          category: true,
        },
      },
    },
  });

  return <DashboardClient user={user} />;
}
