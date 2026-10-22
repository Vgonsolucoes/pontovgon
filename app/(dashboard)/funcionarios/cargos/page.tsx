import { requireRole } from "@/server/lib/auth";
import { Catalog } from "@/components/catalog";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRole(["MASTER", "ADMIN", "RH"]); return <Catalog module="positions" title="Cargos" />; }
