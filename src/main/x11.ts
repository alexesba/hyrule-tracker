/**
 * Whether to force Electron to use X11. DISPLAY identifies the X server advertised by the session.
 * HYRULE_TRACKER_WAYLAND=1 lets Electron select the backend and takes priority over HYRULE_TRACKER_X11=1.
 * `nvidia`: NVIDIA's driver is loaded. In a Wayland session XWayland then showed an invisible window
 * (KDE, RTX 4070 Ti, driver 620; #10), even with the GPU off, so the native Wayland backend is used.
 */
export function useX11(env: Record<string, string | undefined>, nvidia = false): boolean {
  if (env.HYRULE_TRACKER_WAYLAND) return false;
  if (env.HYRULE_TRACKER_X11) return true;
  if (nvidia && env.WAYLAND_DISPLAY) return false;
  return !!env.DISPLAY;
}
