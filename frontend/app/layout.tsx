import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCA e-Statement",
  description: "Auto-categorize your BCA bank statements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
