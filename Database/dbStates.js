/**
 * MongoDB Connection States
 * For checking connection status
 */
export const CONNECTION_STATES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
    99: 'uninitialized'
};

export const isConnected = (state) => state === 1;

export const getConnectionStateName = (state) => {
    return CONNECTION_STATES[state] || 'unknown';
};


