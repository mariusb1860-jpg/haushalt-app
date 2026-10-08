// Cloudflare Worker: stores the phone's push subscription and today's
// "open tasks" count, and sends reminders at 20:30 and 22:30 Berlin time
// when something is still open.

import { handleRequest, remind } from "./app.js";

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },

  async scheduled(controller, env) {
    const result = await remind(env, controller.scheduledTime);
    console.log(`reminder ${controller.cron}: ${result}`);
  },
};
