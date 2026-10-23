import { AdjustmentsManager } from "@/components/adjustments-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ajustes · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
  return <AdjustmentsManager />;
}
