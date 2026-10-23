import { ScheduleManager } from "@/components/schedule-manager";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Jornadas · VGON PONTO" };
export default async function Page() {
  await requireRole(["MASTER", "ADMIN", "RH"]);
  return <ScheduleManager />;
}
