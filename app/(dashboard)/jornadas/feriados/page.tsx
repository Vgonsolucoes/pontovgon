import { AdminCatalog } from "@/components/admin-catalog";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Feriados · VGON PONTO" };
export default async function Page() { await requireRole(["MASTER", "ADMIN", "RH"]); return <AdminCatalog module="holidays" />; }
