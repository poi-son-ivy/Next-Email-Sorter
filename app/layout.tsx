import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
