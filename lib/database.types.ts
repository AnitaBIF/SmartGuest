export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TipoUsuario = "administrador" | "anfitrion" | "jefe_cocina" | "seguridad" | "invitado";
export type EstadoMesa = "pendiente" | "preparacion" | "despachado";
export type RolSmartpool = "conductor" | "pasajero" | "no";
export type EstadoAsistencia = "pendiente" | "confirmado" | "rechazado";

export interface Database {
  public: {
    Tables: {
      usuarios: {
        Row: {
          id: string;
          email: string;
          nombre: string;
          apellido: string;
          dni: string;
          tipo: TipoUsuario;
          max_invitados: number;
          salon_nombre: string | null;
          salon_direccion: string | null;
          cuit: string | null;
          habilitacion_numero: string | null;
          salon_menus_especiales: string[];
          salon_menus_especiales_otro: string | null;
          salon_menu_standard: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "created_at">;
        Update: Partial<Omit<Database["public"]["Tables"]["usuarios"]["Row"], "id" | "created_at">>;
        Relationships: [];
      };
      eventos: {
        Row: {
          id: string;
          nombre: string;
          tipo: string | null;
          fecha: string;
          horario: string;
          salon: string;
          direccion: string;
          anfitrion1_nombre: string;
          anfitrion2_nombre: string | null;
          cant_invitados: number;
          cant_mesas: number;
          menu_standard: string | null;
          monto_total: number;
          sena: number;
          dress_code: string | null;
          menus_especiales: string[];
          menus_especiales_otro: string | null;
          anfitrion_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["eventos"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["eventos"]["Insert"]>;
        Relationships: [];
      };
      mesas: {
        Row: {
          id: string;
          evento_id: string;
          numero: number;
          estado: EstadoMesa;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["mesas"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["mesas"]["Insert"]>;
        Relationships: [];
      };
      invitados: {
        Row: {
          id: string;
          usuario_id: string;
          evento_id: string;
          mesa_id: string | null;
          asistencia: EstadoAsistencia;
          restriccion_alimentaria: string | null;
          restriccion_otro: string | null;
          cancion: string | null;
          direccion: string | null;
          localidad: string | null;
          grupo: string | null;
          rango_etario: string | null;
          telefono: string | null;
          smartpool_lat: number | null;
          smartpool_lng: number | null;
          smartpool_pareja_invitado_id: string | null;
          smartpool_acepto: boolean;
          smartpool_cupos_max: number;
          smartpool_grupo_vehiculo_lleno: boolean;
          grupo_cupos_max: number;
          grupo_personas_confirmadas: number | null;
          grupo_menus_json: unknown;
          rol_smartpool: RolSmartpool | null;
          qr_token: string | null;
          qr_expires_at: string | null;
          ingresado: boolean;
          ingreso_at: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["invitados"]["Row"],
          | "id"
          | "created_at"
          | "smartpool_acepto"
          | "smartpool_pareja_invitado_id"
          | "smartpool_cupos_max"
          | "smartpool_grupo_vehiculo_lleno"
          | "grupo_cupos_max"
          | "grupo_menus_json"
          | "ingresado"
          | "ingreso_at"
        > & {
          smartpool_acepto?: boolean;
          smartpool_pareja_invitado_id?: string | null;
          smartpool_cupos_max?: number;
          smartpool_grupo_vehiculo_lleno?: boolean;
          grupo_cupos_max?: number;
          grupo_menus_json?: unknown;
          ingresado?: boolean;
          ingreso_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invitados"]["Insert"]>;
        Relationships: [];
      };
      reuniones: {
        Row: {
          id: string;
          titulo: string;
          fecha: string;
          hora: string;
          participantes: string | null;
          notas: string | null;
          creado_por: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reuniones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reuniones"]["Insert"]>;
        Relationships: [];
      };
      canciones: {
        Row: {
          id: string;
          evento_id: string;
          titulo: string;
          artista: string;
          pedido_por: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["canciones"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["canciones"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
