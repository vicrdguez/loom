import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function loomWorkers(pi: ExtensionAPI) {
  pi.registerCommand("loom-workers", {
    description: "Run and inspect Loom Board workers",
    handler: async (_args, ctx) => {
      ctx.ui.notify("The Loom Worker console is not started.", "info");
    },
  });
}
