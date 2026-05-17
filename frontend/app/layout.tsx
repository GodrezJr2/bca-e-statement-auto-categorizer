import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "BCA e-Statement",
  description: "Auto-categorize your BCA bank statements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{document.documentElement.setAttribute("data-theme",localStorage.getItem("theme")==="dark"?"dark":"light")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
