import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JEV Decision Demos',
  description: 'Demonstrações interativas do modelo JEV da TypeSafe',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0A0E17] text-[#E8ECF4] antialiased">
        {children}
      </body>
    </html>
  );
}