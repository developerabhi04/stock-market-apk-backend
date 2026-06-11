import { connectDB } from '../shared/database/db.js';

export const connectDatabase = async () => {
    await connectDB();
};

export default connectDatabase;