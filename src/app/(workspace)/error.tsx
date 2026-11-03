'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {return <div className="empty-state"><h2>Nu am putut încărca spațiul de lucru</h2><p>Verificați conexiunea și încercați din nou.</p><button className="button primary" onClick={reset}>Încearcă din nou</button></div>;}
