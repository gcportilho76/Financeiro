import { createStartHandler, defaultRenderHandler } from "@tanstack/react-start/server";
import { createRouter } from "./router";

export const startHandler = createStartHandler({
  createRouter,
  getRouterManifest: () => import("@tanstack/react-start/router-manifest"),
});

export default startHandler(defaultRenderHandler);