export type MenuCount = {
  standard: number;
  celiaco: number;
  vegVeg: number;
  otros: number;
  otrosDetalle?: string;
};

export type Mesa = {
  id: string | number;
  numero: number;
  estado?: string;
  menus: MenuCount;
};

export type EventoCocina = {
  id: string;
  titulo: string;
  fecha: string;
  anfitriones: string;
  mesas: Mesa[];
};
