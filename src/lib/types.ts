export type Skill = {
  id: string;
  name: string;
  title: string;
  description: string;
  category: string;
  groupId: string;
  relatedGroupIds: string[];
  classificationReason: string;
  sourceCategory: string;
  compatibility: string;
  files: string[];
  scripts: number;
  version: string;
  image: string | null;
  execution: string;
};
export type Catalog = {
  skills: Skill[];
  fileCount: number;
  version: string;
  categories: string[];
  families: { id: string; label: string }[];
  groups: ScienceGroup[];
};
export type ScienceGroup = {
  id: string;
  label: string;
  family: string;
  icon: string;
  description: string;
  count: number;
};
export type AIModelInfo = {
  id: string;
  name: string;
  provider?: string;
  tier?: "free" | "standard" | "preview" | "default";
};
export type Paper = {
  id: string;
  title: string;
  year: number | null;
  authors: string[];
  doi: string | null;
  url: string;
  citations: number;
  venue: string;
  abstract: string;
  openAccess: boolean;
};
export type Project = {
  id: string;
  title: string;
  notes: string;
  skills: string[];
  papers: Paper[];
  updated: string;
};
