import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    {
      path: "/api/discovery/geocode",
      method: "GET",
    },
    {
      path: "/api/discovery/geocode/google",
      method: "GET",
    },
    {
      path: "/api/voice/token",
      method: "POST",
    },
  ],
});
