export interface Evidence { quote: string; start: number; end: number }
export interface Action {
  id: string;
  title: string;
  detail: string;
  evidence: Evidence;
  due_date: string | null;
  deadline_evidence: Evidence | null;
}
export interface Task extends Action {
  done: boolean;
  titleEdited: boolean;
  dateEdited: boolean;
}
export interface Analysis {
  id: string;
  title: string;
  summary: string;
  source_text: string;
  actions: Action[];
  documents: { name: string; evidence: Evidence }[];
  warnings: string[];
  mode: 'live' | 'demo';
  mode_reason: string;
  source_type: 'text' | 'image' | 'example';
  created_at: string;
}
export interface Example {
  id: string;
  label: string;
  category: string;
  description: string;
  text: string;
}
export interface Health { ai_configured: boolean; model: string; max_image_bytes: number }
export interface Selection { key: string; evidence: Evidence }
