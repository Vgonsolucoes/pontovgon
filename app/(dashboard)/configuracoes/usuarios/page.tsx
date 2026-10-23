import { PeopleManager } from "@/components/people-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Usuários · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN"]);
  return <PeopleManager module="users" />;
}
