import { TimeSheetManager } from "@/components/time-sheet-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Espelho de Ponto · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
  return <TimeSheetManager />;
}
