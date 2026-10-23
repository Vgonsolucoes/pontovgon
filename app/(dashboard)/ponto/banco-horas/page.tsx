import { HourBankManager } from "@/components/hour-bank-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Banco de Horas · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
  return <HourBankManager />;
}
