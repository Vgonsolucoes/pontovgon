type PositionSeedStore = {
  findFirst(args: { where: { name: string; departmentId: null } }): Promise<{ id: string } | null>;
  create(args: { data: { name: string; departmentId: string | null; active: boolean } }): Promise<unknown>;
  upsert(args: {
    where: { name_departmentId: { name: string; departmentId: string } };
    create: { name: string; departmentId: string; active: boolean };
    update: Record<string, never>;
  }): Promise<unknown>;
};

/** SQL NULL cannot be used in Prisma's compound unique selector. Preserve existing records. */
export async function ensureSeedPosition(store: PositionSeedStore, name: string, departmentId?: string) {
  if (departmentId) {
    await store.upsert({
      where: { name_departmentId: { name, departmentId } },
      create: { name, departmentId, active: true },
      update: {},
    });
    return;
  }
  const existing = await store.findFirst({ where: { name, departmentId: null } });
  if (!existing) await store.create({ data: { name, departmentId: null, active: true } });
}
