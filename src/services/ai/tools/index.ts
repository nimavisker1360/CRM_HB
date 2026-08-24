import "server-only";

import { customerTools } from "@/services/ai/tools/customer.tools";
import { followUpTools } from "@/services/ai/tools/followup.tools";
import { matchTools } from "@/services/ai/tools/match.tools";
import { projectTools } from "@/services/ai/tools/project.tools";
import { propertyTools } from "@/services/ai/tools/property.tools";
import { reportTools } from "@/services/ai/tools/report.tools";

export const approvedAITools = [...customerTools, ...propertyTools, ...projectTools, ...matchTools, ...followUpTools, ...reportTools];

export function approvedAIToolMap() {
  return new Map(approvedAITools.map((tool) => [tool.declaration.name, tool]));
}
