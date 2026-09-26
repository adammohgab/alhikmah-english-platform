import { createBrowserRouter } from "react-router-dom";
import { HeroPage } from "@/pages/hero/HeroPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HeroPage />,
  },
  {
    path: "*",
    element: <HeroPage />,
  },
]);
