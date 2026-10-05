import Link from "next/link";
import { ArrowLeft, Building2, Save, Store } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  await requireRole(["MASTER", "ADMIN"]);

  const defaults = {
    name: "Vgon Soluções em Informática Ltda.",
    tradeName: "Vgon Soluções em Informática",
    cnpj: "00.000.000/0001-00",
    ie: "Isento",
    email: "contato@vgonsolucoes.com.br",
    phone: "(31) 3000-0000",
    address: "Av. Principal, 000 - Centro",
    city: "Belo Horizonte",
    state: "MG",
    zip: "30000-000",
    timezone: "America/Sao_Paulo",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/dashboard" className="hover:text-vgon-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Configurações</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">Empresa</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-vgon-blue-600" /> Dados da empresa
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configurações gerais usadas nos relatórios, espelho de ponto e comunicações.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
        </Button>
      </div>

      <Alert variant="default" className="bg-emerald-50 border-emerald-200 text-emerald-900">
        <Badge variant="success" className="mr-2">Configuração crítica</Badge>
        <AlertTitle className="text-sm font-semibold">Dados usados em documentos oficiais</AlertTitle>
        <AlertDescription className="text-xs">
          Alterações no CNPJ, razão social e endereço refletem imediatamente em espelhos de ponto e relatórios gerados após a alteração.
        </AlertDescription>
      </Alert>

      <form className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Identificação</CardTitle>
            <CardDescription>Dados fiscais e contratuais.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="company-name">Razão social</Label>
              <Input id="company-name" defaultValue={defaults.name} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="company-trade">Nome fantasia</Label>
              <Input id="company-trade" defaultValue={defaults.tradeName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-cnpj">CNPJ</Label>
              <Input id="company-cnpj" defaultValue={defaults.cnpj} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-ie">Inscrição estadual</Label>
              <Input id="company-ie" defaultValue={defaults.ie} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-email">E-mail</Label>
              <Input id="company-email" type="email" defaultValue={defaults.email} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-phone">Telefone</Label>
              <Input id="company-phone" defaultValue={defaults.phone} />
            </div>
          </CardContent>
          <Separator />
          <CardHeader className="pb-3 pt-5">
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-6 gap-4">
            <div className="space-y-1.5 md:col-span-4">
              <Label htmlFor="company-address">Endereço</Label>
              <Input id="company-address" defaultValue={defaults.address} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="company-zip">CEP</Label>
              <Input id="company-zip" defaultValue={defaults.zip} />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="company-city">Cidade</Label>
              <Input id="company-city" defaultValue={defaults.city} />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="company-state">UF</Label>
              <Input id="company-state" maxLength={2} defaultValue={defaults.state} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="company-tz">Timezone</Label>
              <Input id="company-tz" defaultValue={defaults.timezone} />
            </div>
            <div className="space-y-1.5 md:col-span-6">
              <Label htmlFor="company-notes">Observações internas</Label>
              <Textarea id="company-notes" placeholder="Observações internas sobre a empresa..." rows={3} />
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="justify-end gap-2 pt-5">
            <Button type="button" variant="ghost">Cancelar</Button>
            <Button type="submit"><Save className="h-4 w-4 mr-1.5" /> Salvar alterações</Button>
          </CardFooter>
        </Card>

        <Card className="border shadow-sm self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Identidade visual</CardTitle>
            <CardDescription>Logo e configurações de comunicação.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center h-40 rounded-xl border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 text-slate-500">
              <div className="flex flex-col items-center gap-2">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-vgon-blue-500 to-emerald-500 text-white grid place-items-center shadow">
                  <Building2 className="h-7 w-7" />
                </div>
                <p className="text-xs">Logotipo da empresa</p>
                <Button size="sm" variant="outline">Alterar logo</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-site">Site</Label>
              <Input id="company-site" defaultValue="https://www.vgonsolucoes.com.br" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company-email-resp">E-mail de respostas automáticas</Label>
              <Input id="company-email-resp" defaultValue="nao-responder@vgonsolucoes.com.br" />
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
