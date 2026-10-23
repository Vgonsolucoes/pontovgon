"use client";
import Image from "next/image";
import { useState } from "react";
export function EmployeePhoto({ existing, onChange, onBusyChange }: { existing?: string; onChange(value: string): void; onBusyChange(value: boolean): void }) {
  const [preview, setPreview] = useState(existing ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(file?: File) {
    if (!file) return;
    setError(""); setBusy(true); onBusyChange(true);
    try {
      if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Selecione JPG ou PNG de até 8 MB");
      const image = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d"); if (!context) throw new Error("Não foi possível preparar a foto");
        context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.9);
        if (data.length > 1400000) throw new Error("Foto muito grande após o preparo. Escolha uma imagem menor.");
        onChange(data); setPreview(data);
      } finally { image.close(); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Foto inválida"); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <div className="space-y-2 md:col-span-2 lg:col-span-3"><label className="block text-sm font-medium" htmlFor="people-photo">Foto para reconhecimento facial</label><input id="people-photo" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={event => void choose(event.target.files?.[0])} /><p className="text-xs text-slate-500">Foto individual, de frente e com boa iluminação. JPG ou PNG até 8 MB; a imagem será preparada para o equipamento. Salve o cadastro antes de enviar.</p>{busy && <p role="status">Preparando foto…</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{preview && <Image src={preview} alt="Foto do funcionário para envio ao iDFace" width={144} height={180} unoptimized className="max-h-48 w-auto rounded border object-contain" />}</div>;
}
