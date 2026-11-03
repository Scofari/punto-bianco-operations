import { Dashboard } from '@/components/dashboard';
import { currentStaff } from '@/server/auth';
import { notFound } from 'next/navigation';
import { ro } from '@/lib/ro';
export default async function SectionPage({params}:{params:Promise<{section:string}>}) {
  const {section}=await params;
  if(!(section in ro.nav)) notFound();
  return <Dashboard section={section as keyof typeof ro.nav} staff={await currentStaff()}/>;
}
