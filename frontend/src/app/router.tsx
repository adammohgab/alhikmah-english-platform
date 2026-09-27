import { createBrowserRouter } from "react-router-dom";
import { HeroPage } from "@/pages/hero/HeroPage";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <HeroPage />,
    },
    {
      path: "*",
      element: <HeroPage />,
    },
  ],
  {
    // Matches Vite `base` so routing works under the project Pages subpath.
    basename: import.meta.env.BASE_URL,
  },
);
