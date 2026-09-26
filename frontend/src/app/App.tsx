import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { I18nProvider } from "@/app/providers/I18nProvider";

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
