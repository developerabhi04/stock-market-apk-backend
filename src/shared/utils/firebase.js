import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are missing in environment variables');
}

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey,
        }),
    });
}

export const sendPushNotification = async ({ token, title, body, data = {} }) => {
    if (!token) return { success: false, reason: 'No FCM token' };

    try {
        const message = {
            token,
            notification: { title, body },
            data: Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
            ),
        };

        const response = await getMessaging().send(message);
        return { success: true, response };
    } catch (error) {
        console.error('❌ FCM push failed:', error.message);
        return { success: false, error: error.message };
    }
};