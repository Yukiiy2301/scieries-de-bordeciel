import type { Product, Recipe, Role, Sawmill } from "./types";

export const STORAGE_KEY = "keizaal-scierie-data-v1";
export const SESSION_KEY = "keizaal-scierie-session";
export const SAWMILL_KEY = "keizaal-scierie-sawmill";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Chef / Admin",
  gestionnaire: "Gestionnaire",
  employe: "Employé",
  client: "Client",
  visiteur: "Visiteur",
  pending: "En attente",
};

/** Rôles qu'un nouveau compte peut demander à l'inscription */
export const REQUESTABLE_ROLES: Role[] = ["gestionnaire", "employe", "client", "visiteur"];

export const SAWMILL_ACCESS_OPTIONS = [
  { value: "rivebois", label: "Scierie de Rivebois" },
  { value: "penombris", label: "Scierie de Pénombris" },
  { value: "both", label: "Les deux scieries" },
] as const;

export type SawmillAccess = "rivebois" | "penombris" | "both";

export const PERSONNEL_ROLES: Role[] = ["admin", "gestionnaire", "employe"];
export const VALIDATOR_ROLES: Role[] = ["admin", "gestionnaire"];

export const DEFAULT_PRODUCTS: Product[] = [
  { id: "charbon-pauvre", name: "Charbon pauvre", salePrice: 1, buybackPrice: 0.5, sellable: true, buyable: true, sortOrder: 1 },
  { id: "charbon-classique", name: "Charbon classique", salePrice: 2, buybackPrice: 1, sellable: true, buyable: true, sortOrder: 2 },
  { id: "charbon-briquette", name: "Charbon briquette", salePrice: 3, buybackPrice: 1.5, sellable: true, buyable: true, sortOrder: 3 },
  { id: "charbon-coke", name: "Charbon coke", salePrice: 6, buybackPrice: 2, sellable: true, buyable: true, sortOrder: 4 },
  { id: "petit-bois", name: "Petit bois", salePrice: 0.4, buybackPrice: 0.2, sellable: true, buyable: true, sortOrder: 5 },
];

export const DEFAULT_SAWMILLS: Sawmill[] = [
  { id: "rivebois", name: "Scierie de Rivebois", taxRate: 0.3, citizenshipSeptims: 50, citizenshipCharcoal: 10 },
  { id: "penombris", name: "Scierie de Pénombris", taxRate: 0.15, citizenshipSeptims: 60, citizenshipCharcoal: 0 },
];

export const DEFAULT_RECIPES: Recipe[] = [
  { id: "fer", name: "Lingot de fer", ingredients: [{ key: "charbon-pauvre", label: "Charbon pauvre", quantity: 6 }, { key: "ore-fer", label: "Minerai de fer", quantity: 6 }], sortOrder: 1 },
  { id: "corindon", name: "Lingot de corindon", ingredients: [{ key: "charbon-pauvre", label: "Charbon pauvre", quantity: 6 }, { key: "ore-corindon", label: "Minerai de corindon", quantity: 6 }], sortOrder: 2 },
  { id: "acier", name: "Lingot d'acier", ingredients: [{ key: "charbon-classique", label: "Charbon classique", quantity: 6 }, { key: "ore-fer", label: "Minerai de fer", quantity: 3 }, { key: "ore-corindon", label: "Minerai de corindon", quantity: 3 }], sortOrder: 3 },
  { id: "or", name: "Lingot d'or", ingredients: [{ key: "charbon-classique", label: "Charbon classique", quantity: 6 }, { key: "ore-or", label: "Minerai d'or", quantity: 6 }], sortOrder: 4 },
  { id: "argent", name: "Lingot d'argent", ingredients: [{ key: "charbon-classique", label: "Charbon classique", quantity: 6 }, { key: "ore-argent", label: "Minerai d'argent", quantity: 6 }], sortOrder: 5 },
  { id: "pierre-de-lune", name: "Lingot de pierre de lune", ingredients: [{ key: "charbon-briquette", label: "Charbon briquette", quantity: 6 }, { key: "ore-pierre-de-lune", label: "Minerai de pierre de lune", quantity: 6 }], sortOrder: 6 },
  { id: "orichalque", name: "Lingot d'orichalque", ingredients: [{ key: "charbon-briquette", label: "Charbon briquette", quantity: 6 }, { key: "ore-orichalque", label: "Minerai d'orichalque", quantity: 6 }], sortOrder: 7 },
  { id: "vif-argent", name: "Lingot de vif-argent", ingredients: [{ key: "charbon-coke", label: "Charbon coke", quantity: 6 }, { key: "ore-argent", label: "Minerai d'argent", quantity: 6 }], sortOrder: 8 },
  { id: "malachite", name: "Lingot de malachite", ingredients: [{ key: "charbon-coke", label: "Charbon coke", quantity: 6 }, { key: "ore-malachite", label: "Minerai de malachite", quantity: 6 }], sortOrder: 9 },
  { id: "ebene", name: "Lingot d'ébène", ingredients: [{ key: "charbon-coke", label: "Charbon coke", quantity: 2 }, { key: "ore-ebene", label: "Minerai d'ébène", quantity: 2 }], sortOrder: 10 },
];

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
