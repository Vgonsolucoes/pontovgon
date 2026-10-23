import { prisma } from "@/server/db";
import { peopleActor, peopleError, PeopleError } from "@/server/lib/people-api";
import { facePhoto } from "@/server/lib/face-photo";
export async function GET(request: Request) {
  try {
    await peopleActor(["MASTER", "ADMIN", "RH"]);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new PeopleError("Funcionário não informado");
    const employee = await prisma.employees.findFirst({ where: { id, deletedAt: null }, select: { photoUrl: true } });
    if (!employee?.photoUrl) throw new PeopleError("Foto não cadastrada", 404);
    const photo = facePhoto(employee.photoUrl);
    return new Response(new Uint8Array(photo.bytes), { headers: { "Content-Type": photo.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return peopleError(error); }
}
