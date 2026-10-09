import { LLMS_TXT, textResponse } from "@/lib/llms-content"

export const GET = () => textResponse(LLMS_TXT)
