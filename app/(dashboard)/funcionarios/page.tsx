import { PeopleManager } from "@/components/people-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Funcionários · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH", "GESTOR"]);
  return <PeopleManager module="employees" />;
}
