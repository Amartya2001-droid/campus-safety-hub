/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDt5YlJ_Zg00aswJXTtCqBJelwLDQfbc2A",
  authDomain: "acadia-campus-hub.firebaseapp.com",
  projectId: "acadia-campus-hub",
  storageBucket: "acadia-campus-hub.firebasestorage.app",
  messagingSenderId: "178102066314",
  appId: "1:178102066314:web:bd5fa015f3a0a86ec7a173",
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
