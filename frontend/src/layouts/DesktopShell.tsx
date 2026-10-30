import type { ReactNode } from "react";

type DesktopShellProps = {
  children: ReactNode;
};

/**
 * Desktop-only application frame. Marketplace state and API data remain owned
 * by App; this component owns only desktop presentation and layout boundaries.
 */
export function DesktopShell({ children }: DesktopShellProps) {
  return <div className="desktop-app-layout" data-app-layout="desktop">{children}</div>;
}
