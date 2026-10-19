import { createStartHandler, defaultRenderHandler } from "@tanstack/react-start/server";
import { createRouter } from "./router";

export const startInstance = createStartHandler({
  createRouter,
});

export default startInstance(defaultRenderHandler);