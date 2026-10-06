import { POST } from "@/app/api/agents/heartbeat/_handler";
import { runAgentHandler } from "./_lib/agentApiAdapter";

export default runAgentHandler("POST", POST);

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
