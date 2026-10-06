import { GET } from "@/app/api/agents/commands/next/_handler";
import { runAgentHandler } from "../_lib/agentApiAdapter";

export default runAgentHandler("GET", GET);
