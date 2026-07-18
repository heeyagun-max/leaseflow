import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "LeaseFlow Data Admin", description: "Governed leasing-data publication workflow" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
