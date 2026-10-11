import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter(
  [
    {
      path: "*",
      element: null,
    },
  ],
  {
    // Matches Vite `base` so routing works under the project Pages subpath.
    basename: import.meta.env.BASE_URL,
  },
);
