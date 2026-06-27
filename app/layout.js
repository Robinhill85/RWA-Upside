import "./globals.css";

const TITLE = "RWA-Upside — daily low-cap RWA radar";
const DESC =
  "An AI agent ranks low-cap RWA / tokenization / stablecoin-yield tokens by upside potential — every day, fully autonomous. Powered by the CoinMarketCap Skill Hub. Research only, not financial advice.";

export const metadata = {
  metadataBase: new URL("https://rwa-upside.vercel.app"),
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, url: "https://rwa-upside.vercel.app", siteName: "RWA-Upside", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#2c4bff" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
