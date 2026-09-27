import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Enforce onboarding for users with temporary credentials
  if (session.user.mustChangeCredentials) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
