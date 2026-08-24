export function resolveCrmEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() !== "false"
}
