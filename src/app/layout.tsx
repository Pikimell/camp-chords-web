import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CampChords — твій пісенник",
  description:
    "Шукай акорди, зберігай улюблені пісні та збирай колекції. Пісенник CampChords з імпортом та експортом для iOS.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
