import Image from 'next/image';

/** The supplied artwork is a reverse logo: white wordmark on a transparent canvas. */
export function BrandLogo({ showContext = false }: { showContext?: boolean }) {
  return (
    <span className="brand-lockup">
      <span className="brand-artwork">
        <Image
          src="/punto-bianco-logo.png"
          alt="Punto Bianco"
          width={1351}
          height={772}
          sizes="(max-width: 760px) 148px, 184px"
        />
      </span>
      {showContext && <span className="brand-context">COORDONAREA VIZITELOR</span>}
    </span>
  );
}
