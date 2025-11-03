import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import "@/lib/queue-init"; // Auto-start unsubscribe queue

export const metadata: Metadata = {
  title: "Email Sorter",
  description: "Sort and manage your Gmail emails",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
