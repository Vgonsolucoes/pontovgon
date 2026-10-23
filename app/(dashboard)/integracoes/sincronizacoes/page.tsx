import { SynchronizationsManager } from "@/components/synchronizations-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sincronizações · VGON PONTO" };
export default async function Page() { await requireRole(["MASTER", "ADMIN"]); return <SynchronizationsManager />; }
