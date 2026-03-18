import mongoose from 'mongoose';

/**
 * MongoDB Connection Configuration
 * Optimized for high-traffic applications (10K-1L users)
 */
const connectDB = async () => {
    try {
        // ✅ CHECK if MONGODB_URI is defined
        if (!process.env.MONGODB_URI) {
            console.error('❌ CRITICAL ERROR: MONGODB_URI is not defined in .env file');
            console.error('📝 Please create a .env file with: MONGODB_URI=mongodb://localhost:27017/TradingDB');
            process.exit(1);
        }

        console.log(`🔗 Connecting to: ${process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@')}`); // Hide credentials

        const options = {
            maxPoolSize: 50,
            minPoolSize: 10,
            socketTimeoutMS: 45000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
            maxIdleTimeMS: 30000,
            waitQueueTimeoutMS: 10000,
            w: 'majority',
            retryWrites: true,
            autoIndex: process.env.NODE_ENV !== 'production',
            family: 4,
            readPreference: 'primary',  // ✅ Required for transactions
            readConcern: { level: 'majority' },  // ✅ Required for transactions
            writeConcern: { w: 'majority' },  // ✅ Required for transactions

            dbName: "Trading",
        };

        // Connect to MongoDB
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);


        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        console.log(`🔌 Pool Size: Min ${options.minPoolSize} | Max ${options.maxPoolSize}`);


        // Monitor connection events
        setupConnectionEventListeners();

        return conn;

    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        console.error('Stack:', error.stack);

        // ✅ EXIT INSTEAD OF RETRY (prevents infinite loop)
        console.error('🛑 Exiting process due to MongoDB connection failure');
        process.exit(1);
    }
};

const setupConnectionEventListeners = () => {
    const db = mongoose.connection;

    db.on('connected', () => {
        console.log('📡 Mongoose connected to MongoDB');
    });

    db.on('disconnected', () => {
        console.warn('⚠️ Mongoose disconnected from MongoDB');
    });

    db.on('error', (err) => {
        console.error('🔴 Mongoose connection error:', err.message);
    });

    db.on('reconnected', () => {
        console.log('🔄 Mongoose reconnected to MongoDB');
    });

    db.on('close', () => {
        console.log('🔒 Mongoose connection closed');
    });
};

const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed gracefully');
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error.message);
        throw error;
    }
};

const getConnectionStats = () => {
    const db = mongoose.connection;

    return {
        readyState: db.readyState,
        host: db.host,
        port: db.port,
        name: db.name,
        models: Object.keys(db.models),
        collections: Object.keys(db.collections)
    };
};

export { connectDB, disconnectDB, getConnectionStats };
export default connectDB;
