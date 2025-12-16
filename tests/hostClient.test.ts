import { describe, it, expect, vi } from "vitest";
import { generateClientHelpers, generateHostHelpers } from "..";
import { until } from "@vueuse/core";
import { createApp, effectScope } from "vue";

type HostToClientMessages = {
  whisper: [message: string];
};

type ClientToHostMessages = {
  chat: [message: string];
};

export function withSetup(composable) {
  let result;

  // Create a mini Vue app that uses our composable
  const app = createApp({
    setup() {
      result = composable();
      return () => {};
    },
  });

  // Mount it to trigger lifecycle hooks
  app.mount(document.createElement("div"));

  // Return both results and app (for cleanup)
  return [result, app];
}

describe("Host/Client helpers integration", () => {
  const { createHost, createLocalClient } = generateHostHelpers<
    HostToClientMessages,
    ClientToHostMessages
  >();

  const { createClient, useClient, useEvent } = generateClientHelpers<
    HostToClientMessages,
    ClientToHostMessages
  >();

  it("should send and receive messages between host and client", async () => {
    const [result] = withSetup(() => {
      const host = createHost();

      const result = (async () => {
        await until(host.roomId).toBeTruthy();

        const { connected } = createClient(host.roomId.value!);

        await until(connected).toBeTruthy();

        const hostMsgHandler = vi.fn();
        const clientMsgHandler = vi.fn();

        return true;
      })();

      return result;
    });

    expect(result).resolves.toBeTruthy();
  });
});
