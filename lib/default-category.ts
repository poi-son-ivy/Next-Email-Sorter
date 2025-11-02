import { prisma } from "./prisma";

/**
 * Ensures a default "General" category exists for a user
 * This category is used as a fallback when AI can't match an email to any other category
 */
export async function ensureDefaultCategory(userId: string) {
  // Check if user already has a General category
  const existingGeneral = await prisma.category.findFirst({
    where: {
      userId,
      name: "General",
    },
  });

  if (existingGeneral) {
    return existingGeneral;
  }

  // Create default General category
  const generalCategory = await prisma.category.create({
    data: {
      userId,
      name: "General",
      description:
        "Catch-all category for emails that don't fit into other specific categories. This includes miscellaneous emails, newsletters, notifications, and any other content that doesn't have a more specific categorization.",
      color: "#6B7280", // Gray color
    },
  });

  console.log(`[Default Category] Created General category for user ${userId}`);

  return generalCategory;
}
