import { auth } from "@/lib/auth";
import { SignIn } from "@/components/sign-in";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  // Redirect to dashboard if already logged in
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Email Sorter</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect your Gmail account to get started
          </p>
        </div>

        <div className="flex justify-center">
          <SignIn />
        </div>
      </div>
    </div>
  );
}
