"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginInnerForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/dashboard";
  const [email, setEmail] = useState("master@vgon.com.br");
  const [password, setPassword] = useState("Mudar@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = "Entrar · VGON PONTO";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        if (res.error.includes("CredentialsSignin") || res.status === 401) {
          setError("Credenciais inválidas. Verifique seu e-mail e senha.");
        } else {
          setError(res.error || "Não foi possível entrar. Tente novamente.");
        }
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" placeholder="voce@vgon.com.br" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link href="/esqueci-minha-senha" className="text-xs text-vgon-blue-600 hover:text-vgon-blue-700 font-medium">
            Esqueci minha senha
          </Link>
        </div>
        <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      {error && (
        <Alert variant="destructive" className="py-2 text-xs">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>) : (<>Entrar <ArrowRight className="h-4 w-4" /></>)}
      </Button>
    </form>
  );
}

function Fallback() {
  return (
    <div className="flex items-center justify-center py-10 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparando formulário…
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<Fallback />}>
      <LoginInnerForm />
    </Suspense>
  );
}

export function LoginDevHint() {
  return (
    <Alert variant="default" className="mt-5 bg-sky-50 border-sky-200 text-sky-900">
      <Info className="h-4 w-4 text-sky-600" />
      <div className="pl-2.5">
        <p className="text-sm font-semibold text-sky-800">Credenciais padrão (dev)</p>
        <p className="text-xs text-sky-700">
          <span className="font-semibold">E-mail:</span> master@vgon.com.br · <span className="font-semibold">Senha:</span> Mudar@123
        </p>
      </div>
    </Alert>
  );
}
