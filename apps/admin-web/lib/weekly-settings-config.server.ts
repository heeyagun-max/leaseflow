import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UserRole } from "@leaseflow/domain";
import { z } from "zod/v3";

const userSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  role: z.enum(["data_steward", "senior_reviewer", "lm_manager", "lm_member", "team_lead", "admin"]),
}).passthrough();

const buildingSchema = z.object({
  id: z.string().min(1),
  canonical_name: z.string().min(1),
}).passthrough();

export interface WeeklySettingsCatalog {
  buildings: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; role: UserRole; building_ids: string[] }>;
}

export function demoDataDirectory() {
  const cwd = process.cwd();
  const root = path.basename(cwd) === "admin-web" ? path.resolve(cwd, "../..") : cwd;
  return path.join(root, "data/demo");
}

export async function loadWeeklySettingsCatalog(): Promise<WeeklySettingsCatalog> {
  const directory = demoDataDirectory();
  const [buildingsRaw, usersRaw, accessRaw] = await Promise.all([
    readFile(path.join(directory, "buildings.json"), "utf8"),
    readFile(path.join(directory, "users.json"), "utf8"),
    readFile(path.join(directory, "building_access.json"), "utf8"),
  ]);
  const buildings = z.array(buildingSchema).parse(JSON.parse(buildingsRaw));
  const users = z.array(userSchema).parse(JSON.parse(usersRaw));
  const access = z.object({
    users: z.array(z.object({
      user_id: z.string().min(1),
      building_ids: z.array(z.string().min(1)),
    }).strict()),
  }).passthrough().parse(JSON.parse(accessRaw));
  return {
    buildings: buildings.map(({ id, canonical_name }) => ({ id, name: canonical_name })),
    users: users.map(({ id, display_name, role }) => ({
      id,
      name: display_name,
      role,
      building_ids: access.users.find((entry) => entry.user_id === id)?.building_ids ?? [],
    })),
  };
}

export function canManageWeeklySettings(role: UserRole) {
  return role === "lm_manager" || role === "admin";
}
