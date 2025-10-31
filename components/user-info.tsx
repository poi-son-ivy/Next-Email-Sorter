import { auth } from "@/auth";
import { SignOut } from "./sign-out";

export async function UserInfo() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Connected Account</h2>
        <div className="space-y-2">
          <p>
            <span className="font-semibold">Name:</span> {session.user.name}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {session.user.email}
          </p>
          {session.accessToken && (
            <p className="text-green-600 dark:text-green-400">
              ✓ Gmail access granted
            </p>
          )}
        </div>
      </div>
      <SignOut />
    </div>
  );
}
