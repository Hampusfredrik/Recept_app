export type Tone = 'accent' | 'sage' | 'sand' | 'clay';
export type SourceType = 'web' | 'book';

export interface Ingredient {
  id: number;
  recipe_id: string;
  position: number;
  amount: number | null;
  /** Övre värdet när mängden är ett intervall. Saknas om databasen inte har kolumnen. */
  amount_max?: number | null;
  unit: string;
  name: string;
  grams: number | null;
  /** Del av receptet, t.ex. "Frosting". Tomt = huvuddelen. */
  section?: string | null;
  lv_food_id: number | null;
  lv_food_name: string | null;
  match_confidence: 'sure' | 'unsure' | null;
  /** Livsmedlet är valt av användaren och matchas aldrig om automatiskt. */
  lv_manual?: boolean;
}

export interface Step {
  id: number;
  recipe_id: string;
  position: number;
  text: string;
  ingredient_ids: number[] | null;
  /** Del av receptet, t.ex. "Frosting". Tomt = huvuddelen. */
  section?: string | null;
}

export interface Tag {
  id: string;
  household_id: string;
  name: string;
  tone: Tone;
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  name: string;
  effort: number;
  portions: number;
  source_type: SourceType;
  url: string | null;
  domain: string | null;
  fetched_at: string | null;
  book_title: string | null;
  page: string | null;
  image_url: string | null;
  created_at: string;
  last_cooked_on: string | null;
  ingredients: Ingredient[];
  steps: Step[];
  tagIds: string[];
  note: { text: string; updated_at: string; updated_by: string | null } | null;
  checked: number[];
  /** Saknas om databasen inte har kolumnen ännu. */
  is_favorite?: boolean;
  /** Användaren som lade in receptet. Saknas om databasen inte har kolumnen. */
  created_by?: string | null;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  recipeCount?: number;
}

/** Ett steg: bara text, eller text i en del av receptet. */
export type StepInput = string | { text: string; section: string | null };

export interface Member { user_id: string; display_name: string | null }

export interface ShoppingExtra { id: number; name: string; checked: boolean; created_by: string | null; created_at: string }
export interface Feedback { id: number; text: string; created_by: string | null; created_at: string; done_at: string | null }

export interface PlanEntry { date: string; recipe_id: string }

export interface NewRecipe {
  name: string;
  effort: number;
  portions: number;
  source_type: SourceType;
  url?: string | null;
  domain?: string | null;
  fetched_at?: string | null;
  book_title?: string | null;
  page?: string | null;
  image_url?: string | null;
  ingredients: { amount: number | null; amount_max?: number | null; unit: string; name: string; section?: string | null }[];
  steps: StepInput[];
  tagIds: string[];
}
