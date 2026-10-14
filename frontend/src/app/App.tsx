import { RouterProvider } from "react-router-dom";
import { router } from "@/app/router";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { I18nProvider } from "@/app/providers/I18nProvider";
import { ToastProvider } from "@/app/providers/ToastProvider";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";
import { WorldProvider } from "@/shared/providers/WorldProvider";
import { EffectsProvider } from "@/shared/providers/EffectsProvider";
import { SoundProvider } from "@/shared/providers/SoundProvider";

/*
 * UI-kit providers wrap everything else so any component, toast or route can use them:
 * Theme (palettes + the world morph) > World (data-world) > Effects (performance tier) > Sound.
 * Button calls useSound(), so SoundProvider must be mounted for any page that renders one.
 */
export function App() {
  return (
    <ThemeProvider>
      <WorldProvider>
        <EffectsProvider>
          <SoundProvider>
            <AuthProvider>
              <QueryProvider>
                <I18nProvider>
                  <ToastProvider>
                    <RouterProvider router={router} />
                  </ToastProvider>
                </I18nProvider>
              </QueryProvider>
            </AuthProvider>
          </SoundProvider>
        </EffectsProvider>
      </WorldProvider>
    </ThemeProvider>
  );
}
