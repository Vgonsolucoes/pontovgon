import { TimeEntriesManager } from "@/components/time-entries-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Marcações · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH", "GESTOR"]);
  return <TimeEntriesManager />;
}
