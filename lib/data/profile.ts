import "server-only";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { computeProfileCompletion } from "@/lib/profile/completion";
import type { CareerGoalValue, ExperienceLevelValue } from "@/lib/profile/options";

/**
 * Data access for the signed-in user's own profile. The owner is always taken
 * from the session — these functions accept no user id.
 */
export async function getMyProfile() {
  const user = await requireUser();
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { careerGoal: true, experienceLevel: true, location: true, bio: true },
  });

  const values = {
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    displayName: user.name ?? "",
    email: user.email,
    image: user.image ?? "",
    // Prisma's enum values are identical to the controlled option lists.
    careerGoal: (profile?.careerGoal ?? "") as CareerGoalValue | "",
    experienceLevel: (profile?.experienceLevel ?? "") as ExperienceLevelValue | "",
    location: profile?.location ?? "",
    bio: profile?.bio ?? "",
  };

  return {
    values,
    hasPassword: user.hasPassword,
    completion: computeProfileCompletion(values),
  };
}
