import { decodeProjectPath, isValidEncodedPath } from '@/lib/project-path';
import { TRPCProvider } from '@/components/providers/TRPCProvider';
import { Toaster } from '@/components/ui/toaster';
import { notFound } from 'next/navigation';

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ path: string }>;
}

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { path: encodedPath } = await params;

  // Validate the encoded path
  if (!isValidEncodedPath(encodedPath)) {
    notFound();
  }

  const projectPath = decodeProjectPath(encodedPath);

  return (
    <TRPCProvider projectPath={projectPath}>
      {children}
      <Toaster />
    </TRPCProvider>
  );
}
