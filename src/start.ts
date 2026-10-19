import { createRouter } from "./router";

export const startInstance = {
  createRouter,
};

export default startInstance;

if (typeof window !== "undefined") {
  const router = createRouter();
  router.load().then(() => {
    router.hydrate();
  });
}