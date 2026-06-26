import "./globals.css";

export const metadata = {
  title: "RWA-Upside · Low-cap RWA radar",
  description:
    "A daily, self-updating ranking of low-market-cap RWA / tokenization / stablecoin-yield tokens. Powered by the CoinMarketCap Skill Hub, Grok, and CreatorCrawl. Research only — not financial advice.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
