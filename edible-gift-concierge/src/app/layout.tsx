import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Edible Gift Concierge — Find the Perfect Gift | Edible Arrangements",
  description:
    "Let our AI-powered Gift Concierge help you find the perfect fruit arrangement, chocolate-dipped treats, or gift basket for any occasion. Powered by Edible Arrangements.",
  keywords: [
    "edible arrangements",
    "gift concierge",
    "fruit arrangements",
    "chocolate covered strawberries",
    "gift baskets",
    "birthday gifts",
    "valentines day gifts",
  ],
  openGraph: {
    title: "Edible Gift Concierge",
    description: "Find the perfect edible gift for any occasion, powered by AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <body className={`${dmSans.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
