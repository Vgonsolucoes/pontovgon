import { PrismaClient, UserRole, DeviceStatus, AgentStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function seedConstant(label: string, len = 24): string {
  const LABEL = label.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
  const pad = "VgOnSeGuRo2o26!";
  const full = (LABEL + "_" + pad).slice(0, len);
  if (full.length >= len) return full;
  return full + pad.slice(0, len - full.length);
}

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
    const deptIdVal = (did ?? Prisma.DbNull) as unknown as string;
    await prisma.positions.upsert({
      where: { name_departmentId: { name: p, departmentId: deptIdVal } },
      create: { name: p, departmentId: did ?? null, active: true },
      update: { active: true, deletedAt: null },
    });
  }

  const IDFACE_SERIAL = "0M0200/01017B";
  const IDFACE_DEVICE_UNIQUE_ID = "4408801109279099";
  const device = await prisma.devices.upsert({
    where: { serialNumber: IDFACE_SERIAL },
    create: {
      name: "iDFace Principal",
      manufacturer: "Control ID",
      model: "iDFace",
      serialNumber: IDFACE_SERIAL,
      firmwareVersion: "6.18.6",
      macAddress: "FC:52:CE:8A:B9:91",
      deviceUniqueId: IDFACE_DEVICE_UNIQUE_ID,
      status: DeviceStatus.ONLINE,
    },
    update: {
      name: "iDFace Principal",
      manufacturer: "Control ID",
      model: "iDFace",
      firmwareVersion: "6.18.6",
      macAddress: "FC:52:CE:8A:B9:91",
      deviceUniqueId: IDFACE_DEVICE_UNIQUE_ID,
      status: DeviceStatus.ONLINE,
      deletedAt: null,
    },
    select: { id: true, deviceUniqueId: true, name: true, serialNumber: true, firmwareVersion: true, macAddress: true },
  });

  const AGENT_TOKEN = seedConstant("agent_local_001", 48);
  const agent = await prisma.agents.upsert({
    where: { token: AGENT_TOKEN },
    create: {
      token: AGENT_TOKEN,
      name: "Agent Local 001 - Sede Vgon",
      version: "0.1.0",
      status: AgentStatus.OFFLINE,
      syncIntervalSec: 30,
      enabled: true,
    },
    update: {
      name: "Agent Local 001 - Sede Vgon",
      status: AgentStatus.OFFLINE,
      enabled: true,
      deletedAt: null,
    },
    select: { id: true, token: true, name: true, syncIntervalSec: true },
  });

  try {
    await prisma.devices.update({
      where: { id: device.id },
      data: { agentId: agent.id },
    });
  } catch {
    // ignore if already set
  }

  console.log(`Seed MASTER pronto: ${user.email} · ${password}`);
  console.log(`Device iDFace: uniqueId=${device.deviceUniqueId} · serial=${device.serialNumber} · fw=${device.firmwareVersion} · mac=${device.macAddress}`);
  console.log(`Agent Local (Bearer token): ${agent.token}`);
  console.log(`    > nome: ${agent.name}  |  syncInterval: ${agent.syncIntervalSec}s  |  vinculado ao device: ${device.deviceUniqueId}`);
  console.log("");
  console.log("=== agent.config.json exemplo ===");
  console.log(JSON.stringify({
    apiUrl: "https://vgonponto-web.54myeq.easypanel.host",
    agentToken: agent.token,
    idface: {
      url: "http://192.168.1.150",
      port: 80,
      user: "admin",
      password: "admin",
      deviceId: device.deviceUniqueId,
    },
    syncIntervalSec: agent.syncIntervalSec,
    mock: false,
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
