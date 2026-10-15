import { useEffect } from "react";

const PLATFORM_NAME = "Wordland";

/** Sets the tab title to "Page name | Platform name" (SHARED-SPEC DocumentTitle rule). */
export function useDocumentTitle(pageName: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${pageName} | ${PLATFORM_NAME}`;
    return () => {
      document.title = previous;
    };
  }, [pageName]);
}
