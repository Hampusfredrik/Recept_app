export type Tone = 'accent' | 'sage' | 'sand' | 'clay';
export type SourceType = 'web' | 'book';

export interface Ingredient {
  id: number;
  recipe_id: string;
  position: number;
  amount: number | null;
  unit: string;
  name: string;
  grams: number | null;
  lv_food_id: number | null;
  lv_food_name: string | null;
  match_confidence: 'sure' | 'unsure' | null;
}

export interface Step {
  id: number;
  recipe_id: string;
  position: number;
  text: string;
  ingredient_ids: number[] | null;
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
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  recipeCount?: number;
}

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
  ingredients: { amount: number | null; unit: string; name: string }[];
  steps: string[];
  tagIds: string[];
}
