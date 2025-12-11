class EventListener<TEvents extends Record<string, any[]>> {
    private events: {
        [K in keyof TEvents]?: Set<(...args: TEvents[K]) => void>
    } = {}

    on<K extends keyof TEvents>(
        key: K,
        handler: (...args: TEvents[K]) => void,
    ): void {
        if (!this.events[key]) {
            this.events[key] = new Set()
        }
        this.events[key]!.add(handler)
    }

    has<K extends keyof TEvents>(key: K) {
        return !!this.events[key]?.size
    }

    off<K extends keyof TEvents>(
        key: K,
        handler: (...args: TEvents[K]) => void,
    ): void {
        const handlers = this.events[key]
        if (handlers) {
            handlers.delete(handler)
            if (handlers.size === 0) {
                delete this.events[key]
            }
        }
    }

    invoke<K extends keyof TEvents>(key: K, ...args: TEvents[K]) {
        const handlers = this.events[key]
        if (handlers) {
            handlers.forEach((handler) => handler(...args))
        }
    }
}

export default EventListener
