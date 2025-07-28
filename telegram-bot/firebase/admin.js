const admin = require('firebase-admin');
const path = require('path');

try {
  const serviceAccount = require('./firebase-adminsdk.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
  });
  
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  process.exit(1);
}

module.exports = {
  admin,
  db: admin.firestore(),
  storage: admin.storage()
};