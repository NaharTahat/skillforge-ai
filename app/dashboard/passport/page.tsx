import { redirect } from "next/navigation";

/** Old Skill Passport address; kept so existing links keep working. */
export default function PassportRedirect() {
  redirect("/dashboard/skill-passport");
}
