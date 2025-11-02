import { signOutAction } from "@/app/actions/auth";

export function SignOut() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Sign Out
      </button>
    </form>
  );
}
