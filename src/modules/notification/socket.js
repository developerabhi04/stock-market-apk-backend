let ioInstance = null;

export const setSocketInstance = (io) => {
    ioInstance = io;
};

export const getSocketInstance = () => {
    if (!ioInstance) {
        console.warn('⚠️ Socket.IO not initialized yet');
    }
    return ioInstance;
};