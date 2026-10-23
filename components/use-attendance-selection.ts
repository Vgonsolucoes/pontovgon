"use client";
import { useEffect, useState } from "react";
import type { AttendanceOptions } from "@/lib/attendance-display";
export function useAttendanceSelection() {
  const [options, setOptions] = useState<AttendanceOptions | null>(null), [employeeId, setEmployeeId] = useState(""), [month, setMonth] = useState(""), [optionError, setOptionError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => { try {
      const response = await fetch("/api/people/attendance-options", { cache: "no-store", signal: controller.signal }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao carregar funcionários");
      if (controller.signal.aborted) return;
      setOptions(result); setMonth(result.today.slice(0, 7)); if (result.employees.length === 1) setEmployeeId(result.employees[0].id);
    } catch (error) { if (!controller.signal.aborted) setOptionError(error instanceof Error ? error.message : "Falha de conexão"); } })();
    return () => controller.abort();
  }, []);
  return { options, employeeId, setEmployeeId, month, setMonth, optionError };
}
