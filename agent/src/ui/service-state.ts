/** sc.exe localizes field labels; numeric Windows service states are stable. */
export function parseServiceState(stdout: string): string {
  const state = stdout.match(/^\s*(?:STATE|ESTADO)\s*:\s*([1-7])\b/im);
  const names = ["UNKNOWN", "STOPPED", "START_PENDING", "STOP_PENDING", "RUNNING", "CONTINUE_PENDING", "PAUSE_PENDING", "PAUSED"];
  return state ? names[Number(state[1])] : "UNKNOWN";
}
