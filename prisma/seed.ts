import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  const email = process.env.SEED_MASTER_EMAIL?.trim() || "master@vgon.com.br";
  const name = process.env.SEED_MASTER_NAME?.trim() || "Master Vgon";
  const password = process.env.SEED_MASTER_PASSWORD?.trim() || "Mudar@123";
  const passwordHash = await hash(password);

  const user = await prisma.users.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.MASTER,
      active: true,
    },
    update: { name, passwordHash, role: UserRole.MASTER, active: true, deletedAt: null },
  });

  // Setores padrão
  const defaultDepts = ["Administrativo", "Comercial", "Técnico", "Financeiro", "Diretoria"];
  for (const d of defaultDepts) {
    await prisma.departments.upsert({
      where: { name: d },
      create: { name: d, active: true },
      update: { active: true, deletedAt: null },
    });
  }

  // Cargos padrão
  const dirId = (await prisma.departments.findUnique({ where: { name: "Diretoria" }, select: { id: true } }))?.id;
  const tecnicoId = (await prisma.departments.findUnique({ where: { name: "Técnico" }, select: { id: true } }))?.id;
  const seeds: Array<[string, string?]> = [
    ["Diretor(a)", dirId],
    ["Técnico de Suporte", tecnicoId],
    ["Analista de RH", undefined],
    ["Analista Financeiro", undefined],
    ["Executivo de Vendas", undefined],
    ["Auxiliar Administrativo", undefined],
  ];
  for (const [p, did] of seeds) {
    await prisma.positions.upsert({
      where: { name_departmentId: { name: p, departmentId: did ?? "none" } },
      create: { name: p, departmentId: did ?? null, active: true },
      update: { active: true, deletedAt: null },
    });
  }

  console.log(`Seed MASTER pronto: ${user.email} · ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
