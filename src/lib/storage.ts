// localStorage persistence for routes & waypoints — no backend.
export type ManeuverType =
  | "start"
  | "right"
  | "left"
  | "straight"
  | "highway"
  | "exit"
  | "terminal"
  | "uturn"
  | "merge"
  | "end";

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  instruction: string;
  maneuver: ManeuverType;
  suggestedGear: string;
  maxSpeed: number; // km/h
  observation: string;
}

export interface Route {
  id: string;
  name: string;
  description?: string;
  waypoints: Waypoint[];
  createdAt: number;
  updatedAt: number;
}

const ROUTES_KEY = "ra_routes_v1";
const ACTIVE_KEY = "ra_active_route_id_v1";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadRoutes(): Route[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ROUTES_KEY);
    if (!raw) {
      const seeded = [seedRoute474()];
      localStorage.setItem(ROUTES_KEY, JSON.stringify(seeded));
      localStorage.setItem(ACTIVE_KEY, seeded[0].id);
      return seeded;
    }
    return JSON.parse(raw) as Route[];
  } catch {
    return [];
  }
}

export function saveRoutes(routes: Route[]) {
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

export function getActiveRouteId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveRouteId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function seedRoute474(): Route {
  const now = Date.now();
  // Coordenadas aproximadas na região de Juiz de Fora / Linha 474
  // Ajustáveis depois pelo Gestor (clique e arraste).
  const wps: Waypoint[] = ([
    {
      lat: -21.7642, lng: -43.3496,
      instruction: "Início do percurso na Rua das Contendas, 626. Verifique cinto e espelhos.",
      maneuver: "start", suggestedGear: "1ª", maxSpeed: 20,
      observation: "Saída do ponto inicial, atenção a pedestres",
    },
    {
      lat: -21.7651, lng: -43.3478,
      instruction: "Siga em frente pela Rua das Contendas até a Avenida Wilson Tavares.",
      maneuver: "straight", suggestedGear: "2ª", maxSpeed: 30,
      observation: "Trecho residencial, mantenha velocidade reduzida",
    },
    {
      lat: -21.7665, lng: -43.3459,
      instruction: "Vire à direita na Avenida Wilson Tavares.",
      maneuver: "right", suggestedGear: "2ª→3ª", maxSpeed: 40,
      observation: "Curva fechada, sinalize antecipadamente",
    },
    {
      lat: -21.7689, lng: -43.3431,
      instruction: "Siga reto pela Wilson Tavares e entre à esquerda na Rua 10.",
      maneuver: "left", suggestedGear: "3ª", maxSpeed: 40,
      observation: "Cruzamento com semáforo",
    },
    {
      lat: -21.7712, lng: -43.3402,
      instruction: "Continue pela Rua Mandarim em direção ao bairro.",
      maneuver: "straight", suggestedGear: "3ª", maxSpeed: 40,
      observation: "Atenção a quebra-molas",
    },
    {
      lat: -21.7738, lng: -43.3375,
      instruction: "Vire à direita na Rua México.",
      maneuver: "right", suggestedGear: "2ª", maxSpeed: 30,
      observation: "Escola próxima, redobre a atenção",
    },
    {
      lat: -21.7756, lng: -43.3349,
      instruction: "Siga pela Rua Chile mantendo velocidade moderada.",
      maneuver: "straight", suggestedGear: "3ª", maxSpeed: 40,
      observation: "Via de mão dupla, atenção ao fluxo",
    },
    {
      lat: -21.7781, lng: -43.3308,
      instruction: "Acesse a Avenida das Américas pela alça à direita.",
      maneuver: "merge", suggestedGear: "3ª→4ª", maxSpeed: 50,
      observation: "Verifique retrovisor antes de entrar",
    },
    {
      lat: -21.7822, lng: -43.3245,
      instruction: "Entre na BR-040 sentido Belo Horizonte.",
      maneuver: "highway", suggestedGear: "4ª→5ª", maxSpeed: 80,
      observation: "Mantenha distância de segurança",
    },
    {
      lat: -21.7896, lng: -43.3148,
      instruction: "Pegue a saída em direção ao Terminal Eldorado.",
      maneuver: "exit", suggestedGear: "4ª", maxSpeed: 60,
      observation: "Reduza progressivamente",
    },
    {
      lat: -21.7943, lng: -43.3089,
      instruction: "Chegada ao Terminal Eldorado. Embarque e desembarque de passageiros.",
      maneuver: "terminal", suggestedGear: "Neutro", maxSpeed: 10,
      observation: "Aguarde sinalização do despachante",
    },
    {
      lat: -21.7921, lng: -43.3122,
      instruction: "Retorno: faça o retorno e inicie o percurso de volta.",
      maneuver: "uturn", suggestedGear: "1ª→2ª", maxSpeed: 20,
      observation: "Retorno controlado, atenção total",
    },
  ] as Omit<Waypoint, "id">[]).map((w) => ({ ...w, id: uid() }));

  return {
    id: uid(),
    name: "Linha 474 — Contendas / Eldorado",
    description: "Itinerário pré-cadastrado da Linha 474",
    waypoints: wps,
    createdAt: now,
    updatedAt: now,
  };
}

export function maneuverLabel(m: ManeuverType): string {
  const map: Record<ManeuverType, string> = {
    start: "Início",
    right: "Direita",
    left: "Esquerda",
    straight: "Em frente",
    highway: "Rodovia",
    exit: "Saída",
    terminal: "Terminal",
    uturn: "Retorno",
    merge: "Acesso",
    end: "Fim",
  };
  return map[m];
}
