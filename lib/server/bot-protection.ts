import { checkBotId } from "botid/server";

export const enforceBotProtection = async (): Promise<Response | null> => {
  try {
    const verification = await checkBotId();

    if (verification.isBot) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    return null;
  } catch (error) {
    console.warn("[botid] verification failed; allowing request", error);
    return null;
  }
};
