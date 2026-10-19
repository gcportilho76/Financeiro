import { createTanStackStartClient } from "@tanstack/react-start/client";
import { createRouter } from "./router";

export const startInstance = createTanStackStartClient({
  createRouter,
});

export default startInstance;