'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowRight, ShieldCheck, CalendarDays, HeartPulse, Eye, EyeOff } from 'lucide-react';
import { ro } from '@/lib/ro';
export function LoginForm() {
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const [visible,setVisible] = useState(false);
  async function login(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget);
    try {
      const client=createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      const {error} = await client.auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});
      if(error) {setError(ro.errors.login);setBusy(false);return;}
      window.location.assign('/overview');
    } catch {setError(ro.errors.generic);setBusy(false);}
  }
  return <main className="login-page"><section className="login-story"><div className="brand login-brand"><span className="brand-mark">pb<span>✦</span></span><div><strong>PUNTO BIANCO</strong><small>CLINICĂ STOMATOLOGICĂ</small></div></div><div className="story-content"><span className="eyebrow">GRIJĂ PENTRU FIECARE DETALIU</span><h1>Un zâmbet frumos<br/>începe cu o vizită<br/><em>bine organizată.</em></h1><p>Tratament, cazare și transferuri. O echipă conectată, o experiență fără griji pentru fiecare pacient.</p><div className="story-features"><span><HeartPulse size={18}/>Îngrijire coordonată</span><span><CalendarDays size={18}/>Vizite organizate</span><span><ShieldCheck size={18}/>Acces securizat</span></div></div><div className="story-footer">Punto Bianco · Platformă internă pentru echipă</div><div className="story-circle"/><div className="story-circle second"/></section><section className="login-panel"><div className="login-card"><span className="eyebrow">BINE AI REVENIT</span><h2>Conectează-te la echipă</h2><p className="muted">Tot ce ai nevoie pentru următoarea vizită.</p><form onSubmit={login}><label>Adresa de email<input type="email" name="email" placeholder="nume@puntobianco.md" autoComplete="username" required/></label><label>Parola<div className="password-field"><input type={visible?'text':'password'} name="password" placeholder="Introdu parola" autoComplete="current-password" required minLength={8}/><button type="button" className="icon-button" aria-label={visible?'Ascunde parola':'Arată parola'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{error&&<p role="alert" className="form-error">{error}</p>}<button className="button primary login-submit" disabled={busy}>{busy?'Se conectează…':'Conectare'}<ArrowRight size={18}/></button></form><div className="login-note"><ShieldCheck size={16}/><span>Accesul este disponibil doar membrilor echipei.<br/>Pentru un cont, contactează administratorul.</span></div></div><p className="login-bottom">Date demonstrative · Fără date reale ale pacienților</p></section></main>;
}
