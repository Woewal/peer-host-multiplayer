import { onMounted, onUnmounted, type Ref, ref } from "vue";

import Peer, { type DataConnection } from "peerjs";
import EventListener from "./utils/eventListener";
import { injectLocal, provideLocal } from "@vueuse/core";

export type Messages = {
  [K: string]: any[];
};

export const generateHostHelpers = <
  THostToClientMessages extends Messages,
  TClientToHostMessages extends Messages
>() => {
  type Connection = {
    id: string;
    send: <T extends keyof THostToClientMessages>(
      key: T,
      ...args: THostToClientMessages[T]
    ) => void;
  };

  const createHost = () => {
    const peer = new Peer(Math.floor(Math.random() * 9999).toString(), {});

    type HostMessages = THostToClientMessages & {
      connect: [id: string];
      disconnect: [id: string];
    };

    const roomId = ref<string>("");

    const connections = ref(new Map<string, Connection>());

    peer.on("open", function (id) {
      console.log("My peer ID is: " + id);
      roomId.value = id;
    });

    peer.on("connection", (conn) => {
      eventListener.invoke("connect", conn.connectionId);
    });

    peer.on("disconnected", (id) => {
      eventListener.invoke("disconnect", id);
    });

    peer.on("error", (error) => {
      alert(error.message);
    });

    const eventListener = new EventListener<
      {
        [K in keyof TClientToHostMessages]: [
          id: string,
          ...TClientToHostMessages[K]
        ];
      } & HostMessages
    >();

    peer.on("connection", (conn) => {
      connections.value.set(conn.connectionId, {
        send: (key, ...args) => {
          conn.send({ key, args }) as any;
        },
        id: conn.connectionId,
      });

      conn.on("data", (data: any) => {
        if (typeof data != "object") return;

        if (!data["key"] || !eventListener.has(data["key"])) return;

        eventListener.invoke(data["key"], conn.connectionId, ...data["args"]);
      });
    });

    peer.on("disconnected", (connectedId) =>
      eventListener.invoke("disconnect", connectedId)
    );

    const state = {
      roomId,
      sendAll: <T extends keyof THostToClientMessages>(
        key: T,
        ...args: THostToClientMessages[T]
      ) => {
        connections.value.forEach((connection) => {
          connection.send(key, ...args);
        });
      },
      send: <T extends keyof THostToClientMessages>(
        id: string,
        key: T,
        ...args: THostToClientMessages[T]
      ) => {
        connections.value.get(id)!.send(key, ...args);
      },
      on: <T extends keyof HostMessages>(
        key: T,
        handler: (id: string, ...args: HostMessages[T]) => void
      ) =>
        eventListener.on(key, (id: string, ...args) =>
          handler(id, ...(args as any))
        ),
      off: <T extends keyof HostMessages>(
        key: T,
        handler: (id: string, ...args: HostMessages[T]) => void
      ) =>
        eventListener.off(key, (id: string, ...args) =>
          handler(id, ...(args as any))
        ),
      invoke: <T extends keyof HostMessages>(
        key: T,
        id: string,
        ...args: HostMessages[T]
      ) => {
        // @ts-ignore
        eventListener.invoke(key, id, ...args);
      },
      connections,
      addLocalClient: (connection: Connection) => {
        connections.value.set(connection.id, connection);
        eventListener.invoke("connect", connection.id);
      },
      removeLocalClient: (id: string) => {
        connections.value.delete(id);
        eventListener.invoke("disconnect", id);
      },
    };

    provideLocal("host", state);

    return state;
  };

  const useClientMessage = <TKey extends TClientToHostMessages>(
    clientId: string,
    key: TKey,
    fn: (...args: TClientToHostMessages[TKey]) => void
  ) => {
    const host = useHost();

    const handler = (id: string, ...args: TClientToHostMessages[TKey]) => {
      if (id === clientId) {
        fn(...args);
      }
    };

    host.on(key, handler);

    onUnmounted(() => {
      host.off(key, handler);
    });
  };

  type Host = ReturnType<
    typeof createHost<THostToClientMessages, TClientToHostMessages>
  >;

  const useHostEvent = (
    key: keyof THostToClientMessages,
    handler: (id: string, ...args: THostToClientMessages[typeof key]) => void
  ) => {
    const host = useHost();

    host.on(key, handler);

    onUnmounted(() => {
      host.off(key, handler);
    });
  };

  const createLocalClient = (host: ReturnType<typeof createHost>) => {
    const eventListener = new EventListener<
      TClientToHostMessages & THostToClientMessages
    >();

    const id = crypto.randomUUID();

    const state: Client = {
      connected: ref(true),
      id,
      on: (key, handler) => eventListener.on(key, handler),
      off: (key, handler) => eventListener.off(key, handler),
      send: (key, ...args) => {
        // @ts-ignore
        host.invoke(key, id, ...args);
      },
    };

    host.addLocalClient({
      id,
      send: (key, ...args) => {
        // @ts-ignore
        eventListener.invoke(key, ...args);
      },
    });

    onUnmounted(() => {
      host.removeLocalClient(id);
    });

    provideLocal("client", state);

    return state;
  };

  export const useHost = () => {
    return injectLocal<Host>("host")!;
  };

  return { useHostEvent, createLocalClient, createHost, useClientEvent };
};

export const useClientEvent = <
  THostToClientMessages extends Messages,
  TKey extends THostToClientMessages
>(
  key: TKey,
  handler: (...args: THostToClientMessages[TKey]) => void
) => {
  const client = useClient();

  onMounted(() => {
    client.on(key, handler);
  });

  onUnmounted(() => {
    client.off(key, handler);
  });
};

// type ClientToHostMessages = {
//   playCard: [card: 3];
//   setMoney: [amount: number];
// };

// type HostToClientMessages = {
//   setColor: [color: string];
//   setMoney: [amount: number];
// };

// type HostMessages = ClientToHostMessages & {
//   connect: [id: string];
//   disconnect: [id: string];
// };

type Client<
  THostToClientMessages extends Messages = {},
  TClientToHostMessages extends Messages = {}
> = {
  id: string;
  connected: Ref<boolean>;
  on: <T extends keyof THostToClientMessages>(
    key: T,
    handler: (...args: THostToClientMessages[T]) => void
  ) => void;
  off: <T extends keyof THostToClientMessages>(
    key: T,
    handler: (...args: THostToClientMessages[T]) => void
  ) => void;
  send: <T extends keyof TClientToHostMessages>(
    key: T,
    ...args: TClientToHostMessages[T]
  ) => void;
};

export const createClient = <THostToClientMessages extends Messages = {}>(
  id: string
) => {
  var peer = new Peer();

  const eventListener = new EventListener<THostToClientMessages>();

  let conn: DataConnection;

  const connected = ref<boolean>(false);

  peer.on("open", () => {
    conn = peer.connect(id);

    conn.on("open", () => {
      connected.value = true;
    });

    conn.on("data", (data) => {
      if (typeof data != "object") return;

      // @ts-ignore
      const key: keyof THostToClientMessages = data["key"];
      // @ts-ignore
      const args: THostToClientMessages[typeof key] = data["args"];

      eventListener.invoke(key, ...args);
    });
  });

  const state: Client = {
    id,
    connected,
    send: (key, ...args) => conn?.send({ key, args }),
    on: (key, handler) => eventListener.on(key, handler),
    off: (key, handler) => eventListener.off(key, handler),
  };

  provideLocal("client", state);

  return state;
};

export const useClient = () => {
  return injectLocal<Client>("client")!;
};

// export const useClientMessage = <
//   TClientsToHostMessages extends Messages,
//   TKey extends keyof TClientsToHostMessages
// >(
//   clientId: string,
//   key: TKey,
//   fn: (...args: TClientsToHostMessages[TKey]) => void
// ) => {
//   const host = useHost();

//   const handler = (id: string, ...args: TClientsToHostMessages[TKey]) => {
//     if (id === clientId) {
//       fn(...args);
//     }
//   };

//   host.on(key, handler);

//   onUnmounted(() => {
//     host.off(key, handler);
//   });
// };
