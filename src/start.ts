import { createTanStackStart } from "@tanstack/react-start";
import { createRouter } from "./router";

export const startInstance = createTanStackStart({
  createRouter,
});

export default startInstance;