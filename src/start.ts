import { createStart } from "@tanstack/react-start";
import { createRouter } from "./router";

export const startInstance = createStart({
  createRouter,
});

export default startInstance;