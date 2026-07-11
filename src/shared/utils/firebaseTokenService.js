import { firebaseAuth } from '../config/firebaseAdmin.js';
import { ApiError } from './apiError.js';

export const verifyFirebaseIdToken = async (idToken) => {
    if (!idToken) {
        throw new ApiError(400, 'Firebase ID token is required');
    }

    try {
        const decoded = await firebaseAuth.verifyIdToken(idToken);

        if (!decoded.phone_number) {
            throw new ApiError(400, 'No phone number found in token');
        }

        return {
            phoneNumber: decoded.phone_number.replace('+91', ''),
            firebaseUid: decoded.uid
        };
    } catch (error) {
        console.error('❌ Firebase token verification failed:', error.message);
        throw new ApiError(401, 'Invalid or expired Firebase token. Please login again.');
    }
};