import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import {Metadata} from "next";

const inter = Inter({
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-display",
});

export const metadata: Metadata = {
  title: {
    template: '%s | Vivarium - an opinionated dev stack',
    default: 'Vivarium - an opinionated dev stack',
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.className} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
