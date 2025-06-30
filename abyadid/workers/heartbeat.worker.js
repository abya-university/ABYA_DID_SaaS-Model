"use client"

function startHeartbeat(interval) {
    const heartbeatInterval = setInterval(() => {
        self.postMessage('heartbeat');
    }, interval);

    return heartbeatInterval;
}

function stopHeartbeat(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
    }
}

let activeInterval = null;

self.addEventListener('message', (event) => {
    const { type, interval } = event.data;

    if (type === 'start') {
        if (activeInterval) stopHeartbeat(activeInterval);
        activeInterval = startHeartbeat(interval || 30000);
    } else if (type === 'stop') {
        stopHeartbeat(activeInterval);
        activeInterval = null;
    }
});

self.addEventListener('beforeunload', () => {
    if (activeInterval) stopHeartbeat(activeInterval);
});