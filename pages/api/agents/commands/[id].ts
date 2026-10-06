import { PATCH } from "@/app/api/agents/commands/[id]/_handler";
import { runAgentHandlerWithId } from "../_lib/agentApiAdapter";

export default runAgentHandlerWithId("PATCH", PATCH as any);
