import { createStartHandler, defaultRenderHandler } from "@tanstack/react-start/server";
import { createRouter } from "./router";

export const startHandler = createStartHandler({
  createRouter,
});

export default startHandler(defaultRenderHandler);