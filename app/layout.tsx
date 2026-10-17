import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const script = localFont({
  src: "../node_modules/@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2",
  variable: "--font-script",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thanksliving",
  description:
    "A map of gratitude. Drop a dot, share what God has done for you, and see people all over the world giving thanks.",
  icons: {
    icon: "/logo-dark.svg",
    apple: "/logo-dark.svg",
  },
  openGraph: {
    title: "Thanksliving",
    description: "Thank God with the world.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f4ec",
};

// Runs before first paint so a saved dark choice never flashes light.
// Default is light; to follow the system instead, fall back to
// matchMedia("(prefers-color-scheme: dark)") when nothing is stored.
const themeScript = `try{var t=localStorage.getItem("tl:theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script above may set data-theme before React hydrates
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${script.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full overflow-hidden">
      <Analytics />
        {children}</body>
    </html>
  );
}
