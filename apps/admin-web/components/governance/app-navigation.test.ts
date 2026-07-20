import type { UserRole } from "@leaseflow/domain";
import { describe, expect, it } from "vitest";
import { navigationItemsForRole } from "./app-navigation";

const expectedManagementLabels: Record<UserRole, string[]> = {
  data_steward: ["Building Data Intake"],
  senior_reviewer: ["Building Data Intake"],
  lm_manager: ["Report Automation", "Audit & Settings"],
  lm_member: [],
  team_lead: [],
  admin: ["Building Data Intake", "Report Automation", "Audit & Settings"],
};

describe("admin navigation role visibility", () => {
  for (const [role, managementLabels] of Object.entries(expectedManagementLabels) as Array<[UserRole, string[]]>) {
    it(`shows the scoped navigation for ${role}`, () => {
      const items = navigationItemsForRole(role);

      expect(items.common.map((item) => item.label)).toEqual(["Workspace", "Requests", "Buildings", "Weekly Reports"]);
      expect(items.management.map((item) => item.label)).toEqual(managementLabels);
    });
  }
});
