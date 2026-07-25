import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nightcut — Agent Video Editor",
  description: "An agent-driven short-form video editor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
