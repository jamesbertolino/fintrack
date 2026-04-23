export function formatData(iso: string, timezone: string, idioma: string): string {
  return new Intl.DateTimeFormat(idioma, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: timezone,
  }).format(new Date(iso))
}

export function formatDataHora(iso: string, timezone: string, idioma: string): string {
  return new Intl.DateTimeFormat(idioma, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: timezone,
  }).format(new Date(iso))
}

export function formatMes(iso: string, idioma: string): string {
  return new Intl.DateTimeFormat(idioma, {
    month: 'short', year: 'numeric',
  }).format(new Date(iso))
}
