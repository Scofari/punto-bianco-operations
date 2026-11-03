import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const muller = localFont({ src:'./fonts/MullerDemo-ExtraBold.otf',weight:'800',style:'normal',variable:'--font-muller',display:'swap',fallback:['Arial','sans-serif'] });
export const metadata: Metadata = { title:'Punto Bianco · Coordonarea vizitelor',description:'Platformă internă de coordonare a vizitelor pacienților Punto Bianco.',robots:{index:false,follow:false} };
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="ro" className={muller.variable}><body>{children}</body></html>;
}
