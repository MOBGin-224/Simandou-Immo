import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';

import './globals.css';

/**
 * Enveloppe de l'application.
 *
 * Deux familles, comme la charte le fixe (DEC-012) : Inter pour le contenu, les
 * formulaires et la navigation, Manrope pour l'identité, les titres et les
 * montants, afin qu'un montant se repère sans être lu.
 *
 * `lang="fr"` n'est pas un détail : sans lui, un lecteur d'écran prononce le
 * français avec une phonétique anglaise, et la césure typographique est fausse.
 */
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'SIMANDOU IMMO',
    template: '%s | SIMANDOU IMMO',
  },
  description: "Gestion opérationnelle d'immeubles locatifs en Guinée.",
};

/**
 * Mobile d'abord (MVP-UI-001, ADR-011) : la largeur de référence est celle du
 * téléphone, et l'échelle doit rester modifiable par l'utilisateur, donc aucun
 * `maximum-scale`.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#123b4a',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${inter.variable} ${manrope.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
