import { LLMS_FULL_TXT, textResponse } from "@/lib/llms-content"

export const GET = () => textResponse(LLMS_FULL_TXT)
