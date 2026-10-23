"use client";
import { Input } from "@/components/ui/input";
import type { AttendanceOptions } from "@/lib/attendance-display";
export function AttendanceSelection({ options, employeeId, setEmployeeId, month, setMonth, disabled }: { options: AttendanceOptions | null; employeeId: string; setEmployeeId: (id: string) => void; month: string; setMonth: (month: string) => void; disabled: boolean }) {
  return <fieldset disabled={disabled || !options} className="no-print grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm">Funcionário<select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={employeeId} onChange={event => setEmployeeId(event.target.value)}><option value="">Selecione o funcionário</option>{options?.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}</select></label><label className="space-y-1 text-sm">Mês de referência<Input type="month" min="2000-01" max="2099-12" required value={month} onChange={event => setMonth(event.target.value)} /></label></fieldset>;
}
