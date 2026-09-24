export const environment = {
  production: false,
  stage: 'LOCAL',
  vercel: {
    isLocalUrl: true,
    baseUrl: 'http://localhost:3001/api/routes',
  },
  srvCatra: {
    baseUrl: '/srv-catra',
    tenantId: 'fitware-util',
    apiKey: 'API_KEY_LOCAL_HERE',
  },
  firebase: {
    apiKey: 'AIzaSyAoGw9Pq0IU11cOZ_Cym_tAJmvgcoLUXzc',
    authDomain: 'fitmanager-util.firebaseapp.com',
    databaseURL: 'https://fitmanager-util-default-rtdb.firebaseio.com',
    projectId: 'fitmanager-util',
    storageBucket: 'fitmanager-util.firebasestorage.app',
    messagingSenderId: '901527488346',
    appId: '1:901527488346:web:3380b4b3116ecec11f1563',
  },
};
