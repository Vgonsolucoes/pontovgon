import Link from "next/link";
import { Fingerprint, Clock, ShieldCheck, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-vgon-blue-900 via-vgon-blue-700 to-vgon-blue-500 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.15),_transparent_60%)] pointer-events-none" />
      <header className="relative z-10 border-b border-white/10">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-vgon-blue-700 shadow-lg">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-wide">VGON PONTO</p>
              <p className="text-[11px] text-white/70">Vgon Soluções em Informática</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-white/90 hover:bg-white/10 hover:text-white">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-white text-vgon-blue-700 hover:bg-white/90 shadow">
              <Link href="/login">
                Acessar sistema <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 container pt-16 pb-24">
        <section className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20 backdrop-blur">
              <Clock className="h-3.5 w-3.5" /> Controle de Jornada · Reconhecimento Facial
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Gestão inteligente de ponto com&nbsp;
              <span className="text-emerald-300">integridade</span>, segurança e&nbsp;
              <span className="text-emerald-300">conformidade</span>.
            </h1>
            <p className="mt-5 text-lg text-white/80 max-w-xl">
              Sistema profissional da Vgon integrado ao Control iD iDFace via Agente Local.
              Cadastro de funcionários, jornadas parametrizáveis, banco de horas, ajustes
              com aprovação, espelho de ponto, auditoria completa e portal individual do funcionário.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-lg">
                <Link href="/login">Acessar o painel</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/5 text-white border-white/20 hover:bg-white/10 hover:text-white">
                <Link href="#recursos">Ver recursos</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/15 p-5 shadow-2xl">
              <div className="grid grid-cols-2 gap-3">
                <FeatureCard icon={<Building2 className="h-5 w-5" />} title="Empresa" desc="Setores, cargos, escalas" />
                <FeatureCard icon={<Clock className="h-5 w-5" />} title="Jornadas" desc="5x2, 6x1, 12x36, personalizada" />
                <FeatureCard icon={<Fingerprint className="h-5 w-5" />} title="iDFace" desc="Integração oficial via Agent" />
                <FeatureCard icon={<ShieldCheck className="h-5 w-5" />} title="Auditoria" desc="Toda operação registrada" />
              </div>
              <div className="mt-5 rounded-xl bg-slate-900/40 p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white/90">Status da integração</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> ONLINE
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                  <Stat label="Agente" value="● Online" tone="ok" />
                  <Stat label="iDFace" value="● Online" tone="ok" />
                  <Stat label="Última sincro" value="agora" tone="ok" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="mt-24 grid md:grid-cols-3 gap-5">
          <Feature
            title="Cadastro completo"
            desc="Funcionários, setores, cargos, jornadas, feriados, férias, atestados e afastamentos parametrizáveis."
          />
          <Feature
            title="Motor de cálculo"
            desc="Múltiplas entradas/saídas, tolerância, horas extras, débito, saldo diário e banco de horas."
          />
          <Feature
            title="Arquitetura MODELO B"
            desc="VGON PONTO Agent na LAN coleta do iDFace e envia via HTTPS. Funcionamento offline, retry e idempotência."
          />
          <Feature
            title="Ajustes com aprovação"
            desc="Solicitação pelo funcionário, aprovação por gestor/RH. Nenhum registro original é sobrescrito."
          />
          <Feature
            title="RBAC e auditoria"
            desc="Perfis Master / Admin / RH / Gestor / Funcionário. Todo evento crítico com trilha de auditoria."
          />
          <Feature
            title="Relatórios e exportação"
            desc="Espelho mensal, folha, banco de horas, horas extras, atrasos, faltas. Excel e impressão."
          />
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Vgon Soluções em Informática · Todos os direitos reservados.</p>
          <p>Arquitetura escalável · Pronta para múltiplos dispositivos e unidades.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/10 transition">
      <div className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center ring-1 ring-emerald-400/30">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="text-xs text-white/65 mt-0.5">{desc}</p>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur hover:bg-white/10 transition">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/70 leading-relaxed">{desc}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "err" }) {
  const color =
    tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-rose-300";
  return (
    <div className="rounded-lg bg-slate-950/40 p-2 border border-white/5">
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className={`mt-1 font-medium ${color}`}>{value}</p>
    </div>
  );
}
