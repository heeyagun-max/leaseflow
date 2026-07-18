import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "LeaseFlow Data Admin",
    template: "%s · LeaseFlow",
  },
  description: "Governed leasing-data publication workflow",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#070b0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const enableDevTools =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== "1";

  return (
    <html lang="en">
      <head>
        {enableDevTools ? (
          <>
            <Script
              src="https://unpkg.com/react-grab/dist/index.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
            <Script
              src="https://unpkg.com/react-scan/dist/auto.global.js"
              crossOrigin="anonymous"
              strategy="beforeInteractive"
            />
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
