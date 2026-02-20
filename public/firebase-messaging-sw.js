/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title ?? "Campus Safety Alert";
  const notificationOptions = {
    body: payload.notification?.body ?? "New update from Campus Safety Hub.",
    icon: "/favicon.ico",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
