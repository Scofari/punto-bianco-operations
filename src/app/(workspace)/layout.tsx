import { redirect } from 'next/navigation';
import { currentStaff } from '@/server/auth';
import { AppError } from '@/lib/domain';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
  let staff;
  try {staff=await currentStaff();} catch(e) {if(e instanceof AppError&&e.status===401) redirect('/login'); if(e instanceof AppError&&e.status===403) return <main className="setup-page"><h1>Acces restricționat</h1><p>{e.message}</p><a href="/login">Înapoi la autentificare</a></main>; throw e;}
  return <Workspace staff={staff}>{children}</Workspace>;
}
