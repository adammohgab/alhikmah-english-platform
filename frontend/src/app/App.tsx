import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { I18nProvider } from "@/app/providers/I18nProvider";
import { ToastProvider } from "@/app/providers/ToastProvider";

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <I18nProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </I18nProvider>
      </QueryProvider>
    </AuthProvider>
  );
}
