import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync(new URL('../../../firebase-service-account.json', import.meta.url))
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
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

        const response = await admin.messaging().send(message);
        return { success: true, response };
    } catch (error) {
        console.error('❌ FCM push failed:', error.message);
        return { success: false, error: error.message };
    }
};