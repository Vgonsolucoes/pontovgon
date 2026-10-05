import Link from "next/link";
import { Fingerprint, ShieldCheck, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import LoginForm, { LoginDevHint } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Entrar · VGON PONTO",
  description: "Acesse o painel administrativo ou portal do funcionário.",
};

export default function LoginPage() {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="flex items-center justify-center px-4 py-12 lg:px-10 order-2 lg:order-1">
        <Card className="w-full max-w-md border-none shadow-xl bg-white/90 backdrop-blur">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-vgon-blue-500 to-emerald-500 text-white shadow">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <p className="text-base font-bold">VGON PONTO</p>
                  <p className="text-[11px] text-slate-500">Vgon Soluções em Informática</p>
                </div>
              </Link>
              <Badge variant="success">Seguro</Badge>
            </div>
            <div className="pt-5">
              <CardTitle className="text-2xl">Acessar sua conta</CardTitle>
              <CardDescription>
                Entre com suas credenciais para acessar o painel ou portal do funcionário.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <LoginForm />
            <LoginDevHint />
          </CardContent>
          <Separator />
          <CardFooter className="text-xs text-slate-500 pt-4 flex-col items-start gap-1.5">
            <p>Ao acessar, você concorda com a política de segurança e privacidade da Vgon.</p>
            <p className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Sessão protegida e auditoria de todas as operações.</p>
          </CardFooter>
        </Card>
      </div>

      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-vgon-blue-700 via-vgon-blue-600 to-emerald-600 text-white p-10 order-1 lg:order-2">
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_top_right,_white_0,_transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur shadow-inner">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <p className="font-bold">VGON PONTO</p>
            <p className="text-[11px] text-white/70">Vgon Soluções em Informática</p>
          </div>
        </div>

        <div className="relative space-y-5 z-10">
          <Badge variant="outline" className="border-white/30 text-white/90 bg-white/5">
            <Clock className="h-3 w-3 mr-1" /> Controle de Jornada · iDFace
          </Badge>
          <h1 className="text-4xl font-bold leading-tight">
            Controle de ponto inteligente, seguro e integrado ao <span className="text-emerald-300">Control iD iDFace</span>.
          </h1>
          <p className="text-white/80 max-w-md text-sm leading-relaxed">
            Dashboard administrativo, portal do funcionário, espelho de ponto, banco de horas,
            férias, atestados e relatórios completos com auditoria total.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md pt-2">
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
              <p className="text-xs text-white/70">Integração</p>
              <p className="text-sm font-semibold pt-0.5">Agente Local (Modelo B)</p>
            </div>
            <div className="rounded-xl bg-white/10 backdrop-blur p-3 border border-white/10">
              <p className="text-xs text-white/70">Segurança</p>
              <p className="text-sm font-semibold pt-0.5">HTTPS + RBAC + Auditoria</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-white/60">© {year} Vgon Soluções em Informática · Todos os direitos reservados.</p>
      </div>
    </div>
  );
}
