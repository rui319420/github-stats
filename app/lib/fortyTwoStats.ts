// Pure normalization of 42 API responses. No network access or secrets here so
// the renderer and tests can share it.

export type FortyTwoProjectStatus = "in_progress" | "waiting_for_correction" | "forming_team";

export interface FortyTwoProject {
  name: string;
  status: FortyTwoProjectStatus;
}

export interface FortyTwoSkill {
  name: string;
  level: number;
}

export interface FortyTwoCoalition {
  name: string;
  color: string;
}

export interface FortyTwoStats {
  login: string;
  campus: string | null;
  cursus: string | null;
  grade: string | null;
  level: number;
  completedProjects: number;
  currentProjects: FortyTwoProject[];
  skills: FortyTwoSkill[];
  coalition: FortyTwoCoalition | null;
}

export const FORTY_TWO_ACCENT = "#00babc";
const MAIN_CURSUS_SLUG = "42cursus";

const ACTIVE_STATUSES: Record<string, FortyTwoProjectStatus> = {
  in_progress: "in_progress",
  waiting_for_correction: "waiting_for_correction",
  searching_a_group: "forming_team",
  creating_group: "forming_team",
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objects(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function time(value: unknown): number {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

// The main curriculum wins; otherwise the most recently started cursus
// (for example a Piscine-only account).
function pickCursus(user: Json): Json | null {
  const entries = objects(user.cursus_users);
  const main = entries.find((entry) => isObject(entry.cursus) && entry.cursus.slug === MAIN_CURSUS_SLUG);
  if (main) return main;
  return entries.reduce<Json | null>(
    (latest, entry) => (!latest || time(entry.begin_at) >= time(latest.begin_at) ? entry : latest),
    null,
  );
}

function pickCampus(user: Json): string | null {
  const campuses = objects(user.campus);
  const primary = objects(user.campus_users).find((entry) => entry.is_primary === true);
  const campus = campuses.find((entry) => entry.id === primary?.campus_id) ?? campuses[0];
  return text(campus?.name);
}

export function normalizeCoalition(payload: unknown): FortyTwoCoalition | null {
  // A user can keep an old (Piscine) coalition; the API lists the newest last.
  const coalition = objects(payload).at(-1);
  const name = text(coalition?.name);
  if (!name) return null;
  const color = text(coalition?.color);
  return { name, color: color && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : FORTY_TWO_ACCENT };
}

export function normalizeFortyTwoUser(payload: unknown, coalitions: unknown = null): FortyTwoStats | null {
  if (!isObject(payload)) return null;
  const login = text(payload.login);
  if (!login) return null;

  const cursusUser = pickCursus(payload);
  const cursus = isObject(cursusUser?.cursus) ? cursusUser.cursus : null;
  const cursusId = cursus?.id ?? cursusUser?.cursus_id;

  // Sub-projects (Piscine days, exam ranks' parts) have a parent and would
  // inflate the counts.
  const projects = objects(payload.projects_users).filter((entry) => {
    const project = isObject(entry.project) ? entry.project : null;
    if (!project || !text(project.name) || project.parent_id != null) return false;
    return cursusId === undefined || !Array.isArray(entry.cursus_ids) || entry.cursus_ids.includes(cursusId);
  });

  const currentProjects = projects.flatMap((entry) => {
    const status = typeof entry.status === "string" ? ACTIVE_STATUSES[entry.status] : undefined;
    return status ? [{ name: text((entry.project as Json).name)!, status }] : [];
  });

  const skills = objects(cursusUser?.skills)
    .flatMap((skill) => {
      const name = text(skill.name);
      return name ? [{ name, level: Math.max(0, finite(skill.level)) }] : [];
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));

  return {
    login,
    campus: pickCampus(payload),
    cursus: text(cursus?.name),
    grade: text(cursusUser?.grade),
    level: Math.max(0, finite(cursusUser?.level)),
    completedProjects: projects.filter((entry) => entry.status === "finished" && entry["validated?"] === true).length,
    currentProjects,
    skills,
    coalition: normalizeCoalition(coalitions),
  };
}
