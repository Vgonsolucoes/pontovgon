import { POST } from "@/app/api/agents/time-entries/batch/_handler";
import { runAgentHandler } from "../_lib/agentApiAdapter";

export default runAgentHandler("POST", POST);

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };
