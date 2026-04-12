/** Solo dígitos. */
export function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** DNI argentino típico 7–8 dígitos (sin validar dígito verificador). */
export function dniValido(dni: string): boolean {
  const d = soloDigitos(dni);
  return d.length >= 7 && d.length <= 8;
}

/** CUIT/CUIL: 11 dígitos. */
export function cuitValido(cuit: string): boolean {
  return soloDigitos(cuit).length === 11;
}

/** Formato visual XX-XXXXXXXX-X */
export function formatearCuit(cuit: string): string {
  const x = soloDigitos(cuit);
  if (x.length !== 11) return x;
  return `${x.slice(0, 2)}-${x.slice(2, 10)}-${x.slice(10)}`;
}
