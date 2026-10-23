import { PeopleManager } from "@/components/people-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/lib/auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Permissões · VGON PONTO" };
const rows = [
  ["Cadastrar usuários e atribuir perfis", "Todos", "Contas não administrativas e a própria conta", "—", "—", "—"],
  ["Gerenciar funcionários", "Sim", "Sim", "Sim", "Consultar equipe direta", "—"],
  ["Gerenciar jornadas", "Sim", "Sim", "Sim", "—", "—"],
  ["Consultar marcações", "Todos", "Todos", "Todos", "Equipe direta", "No próprio espelho"],
  ["Consultar espelho e banco de horas", "Todos", "Todos", "Todos", "Equipe direta", "Próprio cadastro"],
  ["Solicitar ajustes", "Todos", "Todos", "Todos", "Equipe direta", "Próprio cadastro"],
  ["Aprovar ou rejeitar ajustes", "Sim", "Sim", "Sim", "—", "—"],
  ["Apurar banco, lançar crédito/débito e estornar", "Sim", "Sim", "Sim", "—", "—"],
  ["Configurar janela e duplicidade", "Sim", "Sim", "—", "—", "—"],
  ["Gerenciar feriados", "Sim", "Sim", "Sim", "—", "—"],
  ["Enviar cadastro e foto ao iDFace", "Sim", "Sim", "Sim", "—", "—"],
  ["Gerenciar dispositivos e sincronizações", "Sim", "Sim", "—", "—", "—"],
  ["Acessar esta tela de permissões", "Sim", "—", "—", "—", "—"],
];
export default async function Page() {
  await requireRole(["MASTER"]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Permissões</h1><p className="mt-1 text-sm text-slate-500">Consulte as regras efetivas de cada perfil e gerencie os perfis das contas abaixo.</p></div>
    <Card><CardHeader><CardTitle>Acesso por perfil</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Operação", "Master", "Administrador", "RH", "Gestor", "Funcionário"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(([operation,...permissions]) => <tr className="border-b" key={operation}><th scope="row" className="p-3 text-left font-medium">{operation}</th>{permissions.map((permission,index) => <td className="p-3" key={index}>{permission}</td>)}</tr>)}</tbody></table></div><p className="mt-4 text-sm text-slate-500">As regras são verificadas no servidor. O perfil Gestor depende do vínculo com o funcionário responsável pela equipe; Funcionário depende do próprio vínculo. Contas sem vínculo não recebem acesso a dados de outras pessoas. Alterações de perfil são aplicadas nas próximas consultas autenticadas e registradas em auditoria.</p><p className="mt-2 text-sm text-slate-500">Somente Master administra perfis Master/Admin. Não é permitido desativar a própria conta nem alterar o próprio perfil. Os perfis têm permissões fixas; atribua o perfil adequado no cadastro abaixo.</p></CardContent></Card>
    <PeopleManager module="users" />
  </div>;
}
