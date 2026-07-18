import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "LeaseFlow 자산 운영",
    template: "%s · LeaseFlow",
  },
  description: "임대 자산 정보와 주간 업무를 한곳에서 관리합니다.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f3ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const enableDevTools =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DISABLE_REACT_DEVTOOLS !== "1";

  return (
    <html lang="ko">
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
