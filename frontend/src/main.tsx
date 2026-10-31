// Keep the earlier prototype available without mixing its global styles into Switchboard.
if (window.location.pathname.startsWith("/notice")) {
  void import("./legacy-main");
} else {
  void import("./switchboard/demo-main");
}
