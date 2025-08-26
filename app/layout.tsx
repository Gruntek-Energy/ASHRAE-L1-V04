export const metadata = {
  title: "ASHRAE Level 1 App",
  description: "Preliminary audit tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
