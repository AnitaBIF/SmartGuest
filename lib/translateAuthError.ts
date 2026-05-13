/**
 * Traduce a español los mensajes de error más comunes de Supabase Auth
 * (que vienen en inglés y son técnicos). Si no encontramos coincidencia,
 * devolvemos el mensaje original o un fallback genérico.
 */
export function translateAuthError(raw: string | null | undefined, fallback = "Ocurrió un error. Intentá de nuevo."): string {
  const text = (raw ?? "").trim();
  if (!text) return fallback;
  const lower = text.toLowerCase();

  // Credenciales mal o cuenta inexistente.
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password") ||
    lower.includes("invalid credentials")
  ) {
    return "Email o contraseña incorrectos.";
  }

  // Campos vacíos.
  if (lower.includes("missing email or phone")) return "Ingresá tu email para continuar.";
  if (lower.includes("missing password")) return "Ingresá tu contraseña para continuar.";
  if (lower === "anonymous sign-ins are disabled") return "Necesitás ingresar tu email y contraseña.";

  // Email mal formado.
  if (lower.includes("unable to validate email address") || lower.includes("invalid email")) {
    return "El email no parece válido. Revisalo y probá de nuevo.";
  }

  // Email no confirmado.
  if (lower.includes("email not confirmed")) {
    return "Tenés que confirmar tu email antes de ingresar. Revisá tu casilla de correo.";
  }

  // Usuario no encontrado.
  if (lower.includes("user not found")) {
    return "No encontramos una cuenta con ese email.";
  }

  // Email ya registrado.
  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "Ese email ya está registrado. Probá iniciar sesión o recuperar la contraseña.";
  }

  // Contraseña corta.
  if (lower.includes("password should be at least") || lower.includes("password is too short")) {
    return "La contraseña es muy corta (mínimo 6 caracteres).";
  }
  if (lower.includes("weak password") || lower.includes("password too weak")) {
    return "La contraseña es muy débil. Combiná letras, números y algún símbolo.";
  }

  // Rate limit / demasiados intentos.
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Demasiados intentos seguidos. Esperá unos minutos antes de volver a intentar.";
  }

  // Sesión expirada.
  if (lower.includes("jwt expired") || lower.includes("session_not_found")) {
    return "Tu sesión venció. Iniciá sesión de nuevo.";
  }

  // Token de recuperación inválido.
  if (lower.includes("token has expired") || lower.includes("expired_token")) {
    return "El enlace expiró. Pedí uno nuevo desde \"Olvidé mi contraseña\".";
  }
  if (lower.includes("invalid token") || lower.includes("token_not_found")) {
    return "El enlace no es válido. Pedí uno nuevo.";
  }

  // Red / Supabase caído.
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("fetch")) {
    return "No pudimos conectar con el servidor. Revisá tu conexión a internet y reintentá.";
  }

  return text || fallback;
}
