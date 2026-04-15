"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import { downloadInvitadosPlantilla } from "@/lib/invitadosPlantillaExcel";
import { parseInvitadosExcelFile } from "@/lib/parseInvitadosExcel";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand sm:text-2xl">
      SMART
      <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
        GUEST
      </span>
    </span>
  );
}

/** Opcional: video que explique la interfaz de invitado (YouTube, Loom, etc.). */
const INVITADO_TUTORIAL_VIDEO_URL =
  typeof process.env.NEXT_PUBLIC_SMARTGUEST_INVITADO_VIDEO_URL === "string"
    ? process.env.NEXT_PUBLIC_SMARTGUEST_INVITADO_VIDEO_URL.trim()
    : "";

type Asistencia = "Pendiente" | "Asiste" | "No asiste";

interface InvitadoRow {
  id: string;
  nombre: string;
  dni: string;
  telefono: string;
  asistencia: Asistencia;
  grupo: string;
  rango: string;
  restriccion: string;
  /** Valor del desplegable de menú (Ninguna / Otro / etiqueta del evento). */
  restriccionSelect: string;
  restriccionOtro: string;
  eco: "Sí" | "No";
  /** Cupos máximos del grupo familiar para el enlace de invitación. */
  grupoCuposMax: number;
  /** Presente en API; usado en EcoGuests. */
  rolSmartpool?: "conductor" | "pasajero" | "no" | null;
  /** Personas confirmadas del grupo (resumen / pool). */
  personasGrupo?: number;
}

/** Texto multilínea legible dentro de celdas de ancho fijo. */
function CellWrap({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <span
      className={`block whitespace-normal break-words text-pretty leading-snug ${className}`}
    >
      {children}
    </span>
  );
}

/** DNI largo o interno (import): una línea, tooltip con valor completo. */
function DniCell({ value }: { value: string }) {
  const compact = value.replace(/\s/g, "");
  const isImportPlaceholder = value.startsWith("SG") && /^SG[0-9a-f]+$/i.test(compact);
  const label = isImportPlaceholder ? "Provisorio" : value;
  return (
    <span
      className="block min-w-0 truncate font-mono text-[10px] leading-tight tracking-tight text-[#6b7280]"
      title={isImportPlaceholder ? `ID interno: ${value}` : value}
    >
      {label}
    </span>
  );
}

/** Solo dígitos para wa.me (código país sin +). */
function digitosTelefonoWhatsApp(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return d;
}

/**
 * "al / a la / a los / a las" ante el nombre del evento (heurística para títulos típicos).
 */
function preposicionAnteNombreEvento(nombreEvento: string): "al" | "a la" | "a los" | "a las" {
  let s = nombreEvento.trim().toLowerCase();
  if (!s) return "al";

  const stripPrefix = (re: RegExp) => {
    while (re.test(s)) s = s.replace(re, "");
  };
  stripPrefix(/^(el|la|los|las)\s+/);
  stripPrefix(/^(gran|mi|tu|su|nuestro|nuestra|vuestro|vuestra|un|una|este|esta|ese|esa)\s+/);

  const tokens = s.split(/[\s\-–—:]+/).filter(Boolean);
  const skip = new Set([
    "gran",
    "mega",
    "super",
    "primer",
    "primera",
    "1er",
    "1°",
    "2da",
    "2do",
    "segunda",
    "segundo",
    "tercer",
    "tercera",
  ]);
  const head =
    tokens.find((t) => !skip.has(t.replace(/\.$/, ""))) ?? tokens[0] ?? "";
  const first = head.replace(/\.$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (!first) return "al";

  if (/^(bodas|fiestas|recepciones|veladas|galas|despedidas)$/.test(first)) return "a las";
  if (/^(casamientos|matrimonios|eventos|juntados|asados|encuentros)$/.test(first)) {
    return "a los";
  }

  if (
    /^(boda|fiesta|recepcion|reunion|reunión|celebracion|celebración|despedida|gala|velada|comunion|comunión|cena|xv)$/.test(
      first,
    )
  ) {
    return "a la";
  }
  if (/^quince(s)?$/.test(first)) return "a la";

  if (
    /^(cumpleaños|cumpleanos|cumple|casamiento|matrimonio|evento|aniversario|brindis|junte|asado|after|recital|salon|salón|encuentro|tributo|show|festejo|festejos|cocktail|coctel|coctél)$/.test(
      first,
    )
  ) {
    return "al";
  }

  if (/(cion|sion|dad|tad|umbre)$/.test(first) && first.length > 5) return "a la";

  if (first.endsWith("o") && first.length > 2) {
    const exFemeninoO = /^(foto|mano|radio|moto|noche|fase|base|clave|festejo)$/; // festejo listed above as al
    if (!exFemeninoO.test(first)) return "al";
  }

  if (first.endsWith("a") && first.length > 2) {
    const exMasculinoA =
      /^(problema|mapa|drama|clima|dia|día|sistema|programa|sofá|sofa|planeta|data|agenda|escena|anecdota|anécdota)$/;
    if (!exMasculinoA.test(first)) return "a la";
  }

  return "al";
}

function formatearFechaEventoAr(fechaIso: string | null | undefined): string {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}/.test(fechaIso)) {
    return "la fecha del evento";
  }
  try {
    const d = new Date(`${fechaIso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "la fecha del evento";
    const s = d.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return "la fecha del evento";
  }
}

function mensajeInvitacionWhatsApp(opts: {
  nombreInvitado: string;
  nombreEvento: string;
  fechaEventoIso: string | null;
  nombreAnfitrion: string;
  url: string;
  tutorialVideoUrl: string;
}) {
  const { nombreInvitado, nombreEvento, fechaEventoIso, nombreAnfitrion, url, tutorialVideoUrl } = opts;
  const primerNombreInv = nombreInvitado.trim().split(/\s+/).filter(Boolean)[0] ?? "";
  const hola = primerNombreInv ? `Hola ${primerNombreInv}` : "Hola";

  const eventoTxt = nombreEvento.trim();
  const fechaLegible = formatearFechaEventoAr(fechaEventoIso);

  const lineaEvento = eventoTxt
    ? `Estás invitado/a ${preposicionAnteNombreEvento(eventoTxt)} *${eventoTxt}* el día *${fechaLegible}*.`
    : `Tenés la invitación al evento el día *${fechaLegible}*.`;

  const bloqueVideo =
    tutorialVideoUrl.length > 0
      ? `\n\nSi querés, este video corto explica cómo funciona la página de invitado en SmartGuest: ${tutorialVideoUrl}`
      : "";

  const firmaAnfitrion = nombreAnfitrion.trim() ? `\n\n${nombreAnfitrion.trim()}` : "";

  return `${hola}, ${lineaEvento}

Para confirmar tu asistencia te dejo el enlace a *SmartGuest*: una vez registrado/a vas a poder ver todos los detalles del evento.

${url}${bloqueVideo}

¡Espero tu asistencia! Que tengas un lindo día.${firmaAnfitrion}`;
}

function IconWhatsApp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-[#166534]">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Icono embudo (filtro) en círculo — abre el panel de filtros de la tabla. */
function FilterTableIcon({ active }: { active?: boolean }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white transition-colors ${
        active
          ? "border-brand text-brand shadow-sm ring-2 ring-brand/15"
          : "border-[#b8d4c4] text-[#2d5a41] hover:border-[#9dc4ae] hover:bg-[#f7fbf9]"
      }`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M22 3H2l8 9.46V19l4 2v-6.54L22 3z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function AsistenciaBadge({ estado, compact }: { estado: Asistencia; compact?: boolean }) {
  const base = compact
    ? "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight border"
    : "inline-flex rounded-full px-3 py-1 text-xs font-medium border";
  if (estado === "Asiste") {
    return (
      <span className={`${base} border-[#7ac48e] bg-[#e7f6ec] text-[#166534]`}>
        Asiste
      </span>
    );
  }
  if (estado === "No asiste") {
    return (
      <span className={`${base} border-[#fca5a5] bg-[#fef2f2] text-[#b91c1c]`}>
        No asiste
      </span>
    );
  }
  return (
    <span className={`${base} border-[#facc15] bg-[#fef9c3] text-[#854d0e]`}>
      Pendiente
    </span>
  );
}

const MAX_EXCEL_BYTES = 10 * 1024 * 1024;

function isExcelFileName(name: string) {
  return /\.(xlsx|xls)$/i.test(name);
}

export default function GestionInvitadosPage() {
  const [openExcel, setOpenExcel] = useState(false);
  const [openManual, setOpenManual] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [invitados, setInvitados] = useState<InvitadoRow[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostName, setHostName] = useState("Anfitrión");
  const [nombreEvento, setNombreEvento] = useState("");
  const [fechaEventoIso, setFechaEventoIso] = useState<string | null>(null);
  const [savingManual, setSavingManual] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtroAsistencia, setFiltroAsistencia] = useState<"" | Asistencia>("");
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroRango, setFiltroRango] = useState("");
  const [filtroEco, setFiltroEco] = useState<"" | "Sí" | "No">("");

  const excelInputRef = useRef<HTMLInputElement>(null);
  const excelDragDepth = useRef(0);
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [excelSelectedFile, setExcelSelectedFile] = useState<File | null>(null);
  const [excelFileError, setExcelFileError] = useState<string | null>(null);
  const [copiedInvitadoId, setCopiedInvitadoId] = useState<string | null>(null);
  const [menuOpciones, setMenuOpciones] = useState<string[]>(["Ninguna"]);

  const invitadoActual = editIndex !== null ? invitados[editIndex] : null;

  const opcionesRestriccionEdit = useMemo(() => {
    const base = menuOpciones;
    const sel = invitadoActual?.restriccionSelect;
    if (sel && !base.includes(sel)) return [sel, ...base];
    return base;
  }, [menuOpciones, invitadoActual?.restriccionSelect]);

  const filtrosActivos = Boolean(
    filtroAsistencia || filtroGrupo || filtroRango || filtroEco,
  );

  const invitadosFiltrados = useMemo(() => {
    return invitados.filter((inv) => {
      if (filtroAsistencia && inv.asistencia !== filtroAsistencia) return false;
      if (filtroGrupo && inv.grupo !== filtroGrupo) return false;
      if (filtroRango && inv.rango !== filtroRango) return false;
      if (filtroEco && inv.eco !== filtroEco) return false;
      return true;
    });
  }, [invitados, filtroAsistencia, filtroGrupo, filtroRango, filtroEco]);

  const opcionesGrupo = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invitados) {
      const g = inv.grupo?.trim();
      if (g && g !== "—") set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [invitados]);

  const opcionesRango = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invitados) {
      const r = inv.rango?.trim();
      if (r && r !== "—") set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [invitados]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  const limpiarFiltros = () => {
    setFiltroAsistencia("");
    setFiltroGrupo("");
    setFiltroRango("");
    setFiltroEco("");
  };

  const urlInvitacionPersonal = (invitadoId: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/invitacion/${invitadoId}`;

  const copyInvitacionPersonal = (invitadoId: string) => {
    const url = urlInvitacionPersonal(invitadoId);
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopiedInvitadoId(invitadoId);
        globalThis.setTimeout(() => setCopiedInvitadoId(null), 2000);
      });
    }
  };

  const enviarInvitacionWhatsApp = async (inv: InvitadoRow) => {
    const phone = digitosTelefonoWhatsApp(inv.telefono);
    if (!phone) return;

    let eventoNombre = nombreEvento.trim();
    let fechaIso = fechaEventoIso;
    if (!eventoNombre || !fechaIso) {
      try {
        const res = await fetch("/api/anfitrion/evento", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json();
          if (typeof d.evento?.nombre === "string" && d.evento.nombre.trim()) {
            eventoNombre = d.evento.nombre.trim();
            setNombreEvento(eventoNombre);
          }
          if (typeof d.evento?.fecha === "string" && d.evento.fecha.trim()) {
            fechaIso = d.evento.fecha.trim();
            setFechaEventoIso(fechaIso);
          }
        }
      } catch {
        /* seguimos con lo que ya tengamos en estado */
      }
    }

    const text = mensajeInvitacionWhatsApp({
      nombreInvitado: inv.nombre,
      nombreEvento: eventoNombre,
      fechaEventoIso: fechaIso,
      nombreAnfitrion: hostName,
      url: urlInvitacionPersonal(inv.id),
      tutorialVideoUrl: INVITADO_TUTORIAL_VIDEO_URL,
    });
    const href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const loadInvitados = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) {
      setLoadingInv(true);
      setLoadError(null);
    }
    try {
      const res = await fetch("/api/anfitrion/invitados", { cache: "no-store" });
      if (res.status === 404) {
        if (!silent) {
          setLoadError("No tenés un evento vinculado. Pedile al administrador que te asigne uno.");
          setInvitados([]);
        }
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const msg = typeof j.error === "string" ? j.error : "Error al cargar";
        if (!silent) {
          throw new Error(msg);
        }
        return;
      }
      const data = await res.json();
      const raw = (data.invitados ?? []) as InvitadoRow[];
      if (Array.isArray(data.menuOpciones) && data.menuOpciones.length > 0) {
        setMenuOpciones(data.menuOpciones as string[]);
      } else {
        setMenuOpciones(["Ninguna"]);
      }
      setInvitados(
        raw.map((row) => ({
          ...row,
          grupoCuposMax: typeof row.grupoCuposMax === "number" ? row.grupoCuposMax : 1,
          restriccionSelect:
            typeof row.restriccionSelect === "string" ? row.restriccionSelect : "Ninguna",
          restriccionOtro: typeof row.restriccionOtro === "string" ? row.restriccionOtro : "",
        })),
      );
      if (!silent) setLoadError(null);
    } catch (e) {
      if (!silent) {
        setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los invitados.");
        setInvitados([]);
      }
    } finally {
      if (!silent) setLoadingInv(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitados();
  }, [loadInvitados]);

  const bloquearAutoRefresh =
    openEdit ||
    openManual ||
    openExcel ||
    importing ||
    savingManual ||
    savingEdit ||
    deletingAll;

  useEffect(() => {
    const puedeRefrescar = () =>
      document.visibilityState === "visible" && !bloquearAutoRefresh;

    const tick = () => {
      if (!puedeRefrescar()) return;
      void loadInvitados({ silent: true });
    };

    const id = setInterval(tick, 12_000);
    return () => clearInterval(id);
  }, [bloquearAutoRefresh, loadInvitados]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" || bloquearAutoRefresh) return;
      void loadInvitados({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [bloquearAutoRefresh, loadInvitados]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/anfitrion/evento");
        if (res.ok) {
          const d = await res.json();
          if (d.usuario?.nombre) setHostName(d.usuario.nombre);
          if (typeof d.evento?.nombre === "string") setNombreEvento(d.evento.nombre);
          if (typeof d.evento?.fecha === "string" && d.evento.fecha.trim()) {
            setFechaEventoIso(d.evento.fecha.trim());
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!openExcel) {
      excelDragDepth.current = 0;
      setExcelDragOver(false);
      setExcelSelectedFile(null);
      setExcelFileError(null);
      setImportSummary(null);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  }, [openExcel]);

  const assignExcelFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!isExcelFileName(file.name)) {
      setExcelFileError("Solo se aceptan archivos .xlsx o .xls.");
      return;
    }
    if (file.size > MAX_EXCEL_BYTES) {
      setExcelFileError("El archivo supera el máximo de 10 MB.");
      return;
    }
    setExcelFileError(null);
    setExcelSelectedFile(file);
  };

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const nombreCompleto = String(fd.get("nombre") || "").trim();
    const celular = String(fd.get("celular") || "").trim();
    const grupo = String(fd.get("grupo") || "").trim();
    const rango = String(fd.get("rango") || "").trim();
    const dni = String(fd.get("dni") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const cuposRaw = Number(fd.get("grupoCuposMax"));
    const grupoCuposMax =
      Number.isFinite(cuposRaw) && cuposRaw >= 1 ? Math.min(20, Math.floor(cuposRaw)) : 1;

    if (!nombreCompleto || !celular || !grupo || !rango) {
      return;
    }

    setSavingManual(true);
    try {
      const res = await fetch("/api/anfitrion/invitados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guests: [
            {
              nombreCompleto,
              celular,
              grupo,
              rangoEtario: rango,
              grupoCuposMax,
              ...(dni ? { dni } : {}),
              ...(email ? { email } : {}),
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "No se pudo guardar.");
        return;
      }
      const errs = (data.errors ?? []) as { message?: string }[];
      if ((data.created ?? 0) < 1 || errs.length > 0) {
        alert(errs[0]?.message ?? "No se pudo crear el invitado.");
        return;
      }
      form.reset();
      setOpenManual(false);
      await loadInvitados({ silent: true });
    } finally {
      setSavingManual(false);
    }
  };

  const handleImportExcel = async () => {
    if (!excelSelectedFile) return;
    setImporting(true);
    setExcelFileError(null);
    setImportSummary(null);

    let refreshListAfter = false;
    let closeModalAfter = false;

    try {
      let rows: Awaited<ReturnType<typeof parseInvitadosExcelFile>>["rows"];
      try {
        const parsed = await parseInvitadosExcelFile(excelSelectedFile);
        if (parsed.error) {
          setExcelFileError(parsed.error);
          return;
        }
        rows = parsed.rows;
      } catch (e) {
        setExcelFileError(
          e instanceof Error ? e.message : "Error al leer el Excel. Probá guardarlo de nuevo como .xlsx.",
        );
        return;
      }

      const guests = rows
        .filter((r) => r.nombreCompleto && r.celular && r.grupo && r.rangoEtario)
        .map((r) => ({
          nombreCompleto: r.nombreCompleto,
          celular: r.celular,
          grupo: r.grupo,
          rangoEtario: r.rangoEtario,
          rowNumber: r.rowNumber,
        }));
      const skipped = rows.length - guests.length;
      if (guests.length === 0) {
        setExcelFileError(
          skipped > 0
            ? `Hay ${skipped} fila(s) pero ninguna tiene los cuatro campos completos (nombre, celular, grupo, rango etario). Revisá celdas vacías o el formato del celular.`
            : "No hay filas de datos debajo de los encabezados.",
        );
        return;
      }

      const controller = new AbortController();
      const timeoutMs = 240_000;
      const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

      let res: Response;
      try {
        res = await fetch("/api/anfitrion/invitados", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ guests }),
          signal: controller.signal,
        });
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          setExcelFileError(
            `La importación superó ${timeoutMs / 60000} minutos. Probá con menos filas o revisá tu conexión.`,
          );
        } else {
          setExcelFileError("No se pudo conectar con el servidor.");
        }
        return;
      } finally {
        globalThis.clearTimeout(timeoutId);
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setExcelFileError("Sesión vencida. Volvé a iniciar sesión e intentá de nuevo.");
        return;
      }
      if (!res.ok) {
        setExcelFileError(typeof data.error === "string" ? data.error : "Error al importar.");
        return;
      }
      const errList = (data.errors ?? []) as { row?: number; message: string }[];
      let msg = `Importados: ${data.created ?? 0} de ${data.total ?? guests.length}.`;
      if (skipped > 0) msg += ` Filas incompletas omitidas: ${skipped}.`;
      if (errList.length) {
        msg += ` Errores: ${errList
          .slice(0, 5)
          .map((e) => (e.row ? `fila ${e.row}` : "—") + `: ${e.message}`)
          .join("; ")}${errList.length > 5 ? "…" : ""}`;
      }
      setImportSummary(msg);
      refreshListAfter = true;
      closeModalAfter = errList.length === 0 && skipped === 0;
    } finally {
      setImporting(false);
    }

    if (refreshListAfter) {
      try {
        await loadInvitados({ silent: true });
      } catch {
        /* la tabla se actualizará al recargar; el resumen del modal ya muestra el resultado */
      }
      if (closeModalAfter) setOpenExcel(false);
    }
  };

  const handleEditarClick = (invitadoId: string) => {
    const index = invitados.findIndex((i) => i.id === invitadoId);
    if (index < 0) return;
    setEditIndex(index);
    setOpenEdit(true);
  };

  const handleEliminarTodos = async () => {
    if (invitados.length === 0) return;
    const n = invitados.length;
    if (
      !globalThis.confirm(
        `¿Eliminar los ${n} invitados de este evento? Los enlaces de invitación dejarán de funcionar. No se puede deshacer.`,
      )
    ) {
      return;
    }
    setDeletingAll(true);
    try {
      const res = await fetch("/api/anfitrion/invitados", {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof j.error === "string" ? j.error : "No se pudo eliminar la lista.");
        return;
      }
      setOpenEdit(false);
      setEditIndex(null);
      await loadInvitados({ silent: true });
    } finally {
      setDeletingAll(false);
    }
  };

  const handleEliminar = async () => {
    if (editIndex === null) return;
    const inv = invitados[editIndex];
    if (!globalThis.confirm("¿Eliminar este invitado del evento?")) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/anfitrion/invitados/${inv.id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof j.error === "string" ? j.error : "No se pudo eliminar.");
        return;
      }
      setOpenEdit(false);
      setEditIndex(null);
      await loadInvitados({ silent: true });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editIndex === null) return;
    const inv = invitados[editIndex];
    const form = event.currentTarget;
    const data = new FormData(form);
    const cuposEdit = Number(data.get("grupoCuposMax"));
    const grupoCuposMax =
      Number.isFinite(cuposEdit) && cuposEdit >= 1 ? Math.min(20, Math.floor(cuposEdit)) : 1;

    const body = {
      nombre: String(data.get("nombre") || ""),
      dni: String(data.get("dni") || ""),
      telefono: String(data.get("telefono") || ""),
      grupo: String(data.get("grupo") || ""),
      rango: String(data.get("rango") || ""),
      restriccion: String(data.get("restriccion") || "Ninguna"),
      restriccionOtro: String(data.get("restriccionOtro") || ""),
      asistencia: String(data.get("asistencia") || "Pendiente"),
      eco: String(data.get("eco") || "No"),
      grupoCuposMax,
    };

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/anfitrion/invitados/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof j.error === "string" ? j.error : "No se pudo guardar.");
        return;
      }
      setOpenEdit(false);
      setEditIndex(null);
      await loadInvitados({ silent: true });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main className="min-w-0 flex-1 pb-8">
          <header className="mb-6 flex items-center justify-between md:hidden">
            <Logo />
          </header>

          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="text-xl font-semibold text-brand sm:text-2xl">
              Gestión de Invitados
            </h1>
            {loadError && (
              <p className="max-w-xl text-xs text-[#b91c1c]">{loadError}</p>
            )}
          </div>

          {/* Botones superiores */}
          <section className="mb-5 max-w-3xl space-y-3 md:ml-auto">
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => downloadInvitadosPlantilla()}
                className="rounded-full bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-4 py-2.5 text-xs font-medium text-white shadow-md shadow-brand/40"
              >
                Descargar plantilla
              </button>
              <button
                type="button"
                onClick={() => setOpenExcel(true)}
                className="rounded-full bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-4 py-2.5 text-xs font-medium text-white shadow-md shadow-brand/40"
              >
                Cargar excel
              </button>
              <button
                type="button"
                onClick={() => setOpenManual(true)}
                className="rounded-full bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-4 py-2.5 text-xs font-medium text-white shadow-md shadow-brand/40"
              >
                Carga manual
              </button>
            </div>
            {!loadingInv && invitados.length > 0 && (
              <button
                type="button"
                onClick={() => void handleEliminarTodos()}
                disabled={deletingAll}
                className="w-full rounded-full border border-red-200 bg-white px-4 py-2.5 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingAll ? "Eliminando…" : "Eliminar todos los invitados"}
              </button>
            )}
          </section>

          {/* Tabla de invitados: ancho completo del contenedor, texto con ajuste de línea */}
          <section className="relative z-0 mt-2 w-full min-w-0 rounded-3xl bg-white/95 p-3 shadow-[0_18px_45px_rgba(0,0,0,0.06)] ring-1 ring-[#d7e6dd] sm:p-4 md:ml-auto">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-brand">Invitados</h2>
                {!loadingInv && invitados.length > 0 && (
                  <div className="mt-1 max-w-2xl space-y-1 text-[11px] leading-snug text-[#6b7280]">
                    <p>
                      {invitadosFiltrados.length === invitados.length
                        ? `${invitados.length} en total`
                        : `Mostrando ${invitadosFiltrados.length} de ${invitados.length}`}
                      {filtrosActivos ? " · filtros activos" : ""}
                    </p>
                    <p className="text-[#5a6b62]">
                      <span className="font-medium text-[#374151]">Cadena:</span> copiar solo el enlace.{" "}
                      <span className="font-medium text-[#374151]">WhatsApp:</span> abre el chat de esa persona con un
                      mensaje listo que incluye el enlace y las instrucciones. La confirmación siempre actualiza{" "}
                      <span className="font-medium text-[#374151]">esa misma fila</span>.
                    </p>
                  </div>
                )}
              </div>
              <div className="relative z-20 shrink-0">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  aria-expanded={filtersOpen}
                  aria-haspopup="dialog"
                  aria-label="Filtrar tabla de invitados"
                >
                  <FilterTableIcon active={filtrosActivos} />
                </button>
                {filtersOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-30 cursor-default bg-transparent"
                      aria-label="Cerrar filtros"
                      onClick={() => setFiltersOpen(false)}
                    />
                    <div
                      role="dialog"
                      aria-label="Filtros de invitados"
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(calc(100vw-2rem),18rem)] rounded-2xl border border-[#d1e5d9] bg-white p-4 shadow-[0_16px_40px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-brand">Filtrar por</p>
                        <button
                          type="button"
                          onClick={() => {
                            limpiarFiltros();
                          }}
                          className="text-[11px] font-medium text-[#6b7280] underline decoration-[#d1d5db] underline-offset-2 hover:text-brand"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="space-y-3 text-[11px]">
                        <div>
                          <label className="mb-1 block font-medium text-foreground">
                            Asistencia
                          </label>
                          <select
                            value={filtroAsistencia}
                            onChange={(e) =>
                              setFiltroAsistencia((e.target.value || "") as "" | Asistencia)
                            }
                            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            <option value="">Todas</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Asiste">Asiste</option>
                            <option value="No asiste">No asiste</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block font-medium text-foreground">
                            Grupo
                          </label>
                          <select
                            value={filtroGrupo}
                            onChange={(e) => setFiltroGrupo(e.target.value)}
                            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            <option value="">Todos</option>
                            {opcionesGrupo.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block font-medium text-foreground">
                            Rango etario
                          </label>
                          <select
                            value={filtroRango}
                            onChange={(e) => setFiltroRango(e.target.value)}
                            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            <option value="">Todos</option>
                            {opcionesRango.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block font-medium text-foreground">
                            EcoGuest
                          </label>
                          <select
                            value={filtroEco}
                            onChange={(e) =>
                              setFiltroEco((e.target.value || "") as "" | "Sí" | "No")
                            }
                            className="w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            <option value="">Todos</option>
                            <option value="Sí">Sí</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiltersOpen(false)}
                        className="mt-4 w-full rounded-full bg-brand py-2 text-xs font-medium text-white hover:bg-brand/90"
                      >
                        Listo
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#e0efe6] bg-gradient-to-b from-[#f7fbf9] to-white">
              {loadingInv ? (
                <p className="py-10 text-center text-sm text-[#6b7280]">
                  Cargando invitados…
                </p>
              ) : invitadosFiltrados.length === 0 && invitados.length > 0 ? (
                <p className="py-10 px-4 text-center text-sm text-[#6b7280]">
                  Ningún invitado coincide con los filtros.{" "}
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="font-medium text-brand underline decoration-brand/30 underline-offset-2"
                  >
                    Limpiar filtros
                  </button>
                </p>
              ) : (
              <div className="w-full rounded-b-2xl">
                <table className="table-fixed w-full border-separate border-spacing-0 text-left text-[11px] leading-snug text-foreground sm:text-[12px]">
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "4%" }} />
                    <col style={{ width: "17%" }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#e6f1ea] text-[9px] font-semibold uppercase tracking-wide text-[#4b5563] sm:text-[10px]">
                      <th className="rounded-tl-2xl px-2 py-2.5 pl-3 align-middle sm:px-3 sm:py-3 sm:pl-4">
                        Nombre y apellido
                      </th>
                      <th className="px-1.5 py-2.5 align-middle sm:px-2 sm:py-3">DNI</th>
                      <th className="px-2 py-2.5 align-middle sm:px-3 sm:py-3">Celular</th>
                      <th className="px-1.5 py-2.5 align-middle sm:px-2 sm:py-3">Asistencia</th>
                      <th className="px-1.5 py-2.5 align-middle sm:px-2 sm:py-3">Grupo</th>
                      <th className="px-1.5 py-2.5 align-middle sm:px-2 sm:py-3">Rango etario</th>
                      <th className="px-1 py-2.5 align-middle sm:px-2 sm:py-3" title="Cupos máximos en el formulario de confirmación">
                        Cupos
                      </th>
                      <th className="px-2 py-2.5 align-middle sm:px-3 sm:py-3">Restricciones</th>
                      <th className="px-1 py-2.5 align-middle sm:px-2 sm:py-3">Eco</th>
                      <th className="rounded-tr-2xl px-1 py-2.5 text-center align-middle sm:px-2 sm:py-3">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitadosFiltrados.map((inv, idx) => {
                      const waOk = Boolean(digitosTelefonoWhatsApp(inv.telefono));
                      return (
                      <tr
                        key={inv.id}
                        className={
                          idx % 2 === 0
                            ? "bg-white/80"
                            : "bg-[#f5fbf7]"
                        }
                      >
                        <td className="min-w-0 border-t border-[#e8efe9] px-2 py-2 pl-3 align-middle text-foreground sm:px-3 sm:py-2.5 sm:pl-4">
                          <CellWrap className="font-medium">{inv.nombre}</CellWrap>
                        </td>
                        <td className="min-w-0 border-t border-[#e8efe9] px-1.5 py-2 align-middle sm:px-2 sm:py-2.5">
                          <DniCell value={inv.dni} />
                        </td>
                        <td className="min-w-0 border-t border-[#e8efe9] px-2 py-2 align-middle break-all text-[#4b5563] sm:px-3 sm:py-2.5">
                          {inv.telefono || "—"}
                        </td>
                        <td className="border-t border-[#e8efe9] px-1.5 py-2 align-middle sm:px-2 sm:py-2.5">
                          <AsistenciaBadge estado={inv.asistencia} compact />
                        </td>
                        <td className="min-w-0 border-t border-[#e8efe9] px-1.5 py-2 align-middle text-[#4b5563] sm:px-2 sm:py-2.5">
                          <span className="block truncate" title={inv.grupo}>
                            {inv.grupo}
                          </span>
                        </td>
                        <td className="min-w-0 border-t border-[#e8efe9] px-1.5 py-2 align-middle text-[#4b5563] sm:px-2 sm:py-2.5">
                          <span className="block hyphens-auto break-words text-pretty">{inv.rango}</span>
                        </td>
                        <td className="border-t border-[#e8efe9] px-1 py-2 text-center align-middle tabular-nums text-[#4b5563] sm:px-2 sm:py-2.5">
                          {inv.grupoCuposMax ?? 1}
                        </td>
                        <td className="min-w-0 border-t border-[#e8efe9] px-2 py-2 align-middle text-[#4b5563] sm:px-3 sm:py-2.5">
                          <CellWrap>{inv.restriccion}</CellWrap>
                        </td>
                        <td className="border-t border-[#e8efe9] px-1 py-2 align-middle text-center text-[#4b5563] sm:px-2 sm:py-2.5">
                          {inv.eco}
                        </td>
                        <td className="border-t border-[#e8efe9] px-1 py-2 align-middle sm:px-2 sm:py-2.5">
                          <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
                            <button
                              type="button"
                              onClick={() => copyInvitacionPersonal(inv.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c7d7ce] bg-white/80 text-[#2d5a41] shadow-sm transition hover:border-[#2d5a41]/30 hover:bg-[#edf6f1] sm:h-8 sm:w-8"
                              title="Copiar enlace personal de invitación"
                              aria-label={`Copiar enlace de invitación para ${inv.nombre}`}
                            >
                              {copiedInvitadoId === inv.id ? <IconCheck /> : <IconLink />}
                            </button>
                            <button
                              type="button"
                              disabled={!waOk}
                              onClick={() => enviarInvitacionWhatsApp(inv)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#25D366]/50 bg-[#25D366]/12 text-[#128C7E] shadow-sm transition enabled:hover:border-[#25D366] enabled:hover:bg-[#25D366]/22 disabled:cursor-not-allowed disabled:opacity-35 sm:h-8 sm:w-8"
                              title={
                                waOk
                                  ? "Enviar invitación por WhatsApp"
                                  : "Agregá un celular válido (editar invitado)"
                              }
                              aria-label={`Enviar invitación por WhatsApp a ${inv.nombre}`}
                            >
                              <IconWhatsApp />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditarClick(inv.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#c7d7ce] bg-white/80 text-brand shadow-sm transition hover:border-brand/35 hover:bg-[#edf6f1] sm:h-8 sm:w-8"
                              aria-label={`Editar ${inv.nombre}`}
                            >
                              <IconPencil />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </section>

          {/* Superposición: Cargar Excel */}
          {openExcel && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 dark:bg-black/55">
              <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl ring-1 ring-[var(--ring-soft)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-brand">
                    Cargar invitados desde Excel
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpenExcel(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <p className="mb-4 text-xs text-muted">
                  Usá la plantilla descargada: columnas obligatorias{" "}
                  <strong>Nombre completo</strong>, <strong>Celular</strong>,{" "}
                  <strong>Grupo</strong> y <strong>Rango etario</strong>. La hoja
                  «Instrucciones» del mismo archivo explica cada campo.
                </p>
                <label
                  htmlFor="excel-upload-anfitrion"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excelDragDepth.current += 1;
                    setExcelDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excelDragDepth.current -= 1;
                    if (excelDragDepth.current <= 0) {
                      excelDragDepth.current = 0;
                      setExcelDragOver(false);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    excelDragDepth.current = 0;
                    setExcelDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    assignExcelFile(file);
                  }}
                  className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center text-xs transition-colors ${
                    excelDragOver
                      ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
                      : "border-border bg-card-muted text-muted hover:bg-card-muted/80"
                  }`}
                >
                  <span className="mb-2 font-medium text-brand">
                    {excelDragOver
                      ? "Soltá el archivo acá"
                      : "Arrastrá el Excel acá o hacé clic para elegir"}
                  </span>
                  <span className="text-muted">
                    .xls, .xlsx — máx. 10 MB
                  </span>
                  {excelSelectedFile && (
                    <span className="mt-3 max-w-full truncate rounded-full bg-card-muted px-3 py-1 text-[11px] font-medium text-foreground ring-1 ring-border">
                      {excelSelectedFile.name}
                    </span>
                  )}
                  {excelFileError && (
                    <span className="mt-2 text-[11px] font-medium text-[#b91c1c]">
                      {excelFileError}
                    </span>
                  )}
                  <input
                    id="excel-upload-anfitrion"
                    ref={excelInputRef}
                    type="file"
                    accept=".xls,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      assignExcelFile(file);
                    }}
                  />
                </label>
                {importSummary && (
                  <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900/50">
                    {importSummary}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenExcel(false)}
                    className="rounded-full border border-border bg-card-muted px-4 py-1.5 text-xs font-medium text-foreground hover:bg-card-muted/80"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={importing || !excelSelectedFile}
                    onClick={() => void handleImportExcel()}
                    className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                  >
                    {importing ? "Importando…" : "Importar"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Superposición: Carga manual */}
          {openManual && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 dark:bg-black/55">
              <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl ring-1 ring-[var(--ring-soft)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-brand">
                    Carga manual de invitado
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpenManual(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={(e) => void handleManualSubmit(e)} className="space-y-3">
                  <LeyendaObligatorios className="text-[11px] text-muted" />
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Nombre completo
                      <Req />
                    </label>
                    <input
                      name="nombre"
                      type="text"
                      required
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Número de celular
                      <Req />
                    </label>
                    <input
                      name="celular"
                      type="tel"
                      required
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Grupo
                      <Req />
                    </label>
                    <input
                      name="grupo"
                      type="text"
                      required
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Rango etario
                      <Req />
                    </label>
                    <input
                      name="rango"
                      type="text"
                      required
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Cupos grupo <span className="font-normal text-[#9ca3af]">(1–20)</span>
                    </label>
                    <input
                      name="grupoCuposMax"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={1}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                      Personas cubiertas por esta invitación (default 1). EcoGuest / SmartPool solo si el valor es entre 1
                      y 5 (plazas en el pool = 5 − cupos).
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      DNI <span className="font-normal text-[#9ca3af]">(opcional)</span>
                    </label>
                    <input
                      name="dni"
                      type="text"
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                      Si lo dejás vacío, se genera un código interno hasta que el invitado complete su perfil.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Email <span className="font-normal text-[#9ca3af]">(opcional)</span>
                    </label>
                    <input
                      name="email"
                      type="email"
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                      Si ya tiene cuenta o querés invitarlo por mail. Si no, se crea un acceso provisional.
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenManual(false)}
                      className="rounded-full border border-border bg-card-muted px-4 py-1.5 text-xs font-medium text-foreground hover:bg-card-muted/80"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingManual}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                    >
                      {savingManual ? "Guardando…" : "Guardar invitado"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Superposición: Editar / eliminar invitado */}
          {openEdit && invitadoActual && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 dark:bg-black/55">
              <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl ring-1 ring-[var(--ring-soft)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-brand">
                    Editar invitado
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenEdit(false);
                      setEditIndex(null);
                    }}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <form
                  key={invitadoActual.id}
                  onSubmit={(e) => void handleEditSubmit(e)}
                  className="space-y-3"
                >
                  <LeyendaObligatorios className="text-[11px] text-muted" />
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Nombre completo
                      <Req />
                    </label>
                    <input
                      name="nombre"
                      defaultValue={invitadoActual.nombre}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      DNI
                    </label>
                    <input
                      name="dni"
                      defaultValue={invitadoActual.dni}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Celular
                      <Req />
                    </label>
                    <input
                      name="telefono"
                      type="tel"
                      defaultValue={invitadoActual.telefono}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-foreground">
                        Grupo
                        <Req />
                      </label>
                      <input
                        name="grupo"
                        defaultValue={invitadoActual.grupo}
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-foreground">
                        Rango etario
                        <Req />
                      </label>
                      <input
                        name="rango"
                        defaultValue={invitadoActual.rango}
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Cupos máx. grupo familiar <span className="font-normal text-[#9ca3af]">(1–20)</span>
                    </label>
                    <input
                      name="grupoCuposMax"
                      type="number"
                      min={1}
                      max={20}
                      defaultValue={invitadoActual.grupoCuposMax ?? 1}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <p className="mt-0.5 text-[10px] text-[#9ca3af]">
                      EcoGuest solo con 1–5. Más de 5: sin insignia ni pool.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-foreground">
                      Restricciones alimentarias
                      <Req />
                    </label>
                    <select
                      name="restriccion"
                      defaultValue={invitadoActual.restriccionSelect}
                      className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      {opcionesRestriccionEdit.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                  {opcionesRestriccionEdit.includes("Otro") && (
                    <div>
                      <label className="block text-[11px] font-medium text-foreground">
                        Detalle si elegís «Otro»
                      </label>
                      <input
                        name="restriccionOtro"
                        defaultValue={invitadoActual.restriccionOtro}
                        placeholder="Especificá la restricción"
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-foreground">
                        Asistencia
                        <Req />
                      </label>
                      <select
                        name="asistencia"
                        defaultValue={invitadoActual.asistencia}
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Asiste">Asiste</option>
                        <option value="No asiste">No asiste</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-foreground">
                        EcoGuest
                        <Req />
                      </label>
                      <select
                        name="eco"
                        defaultValue={invitadoActual.eco}
                        className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => void handleEliminar()}
                      className="rounded-full border border-[#fecaca] px-4 py-1.5 text-xs font-medium text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50"
                    >
                      Eliminar invitado
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenEdit(false);
                          setEditIndex(null);
                        }}
                        className="rounded-full border border-border bg-card-muted px-4 py-1.5 text-xs font-medium text-foreground hover:bg-card-muted/80"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                      >
                        {savingEdit ? "Guardando…" : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
    </main>
  );
}

