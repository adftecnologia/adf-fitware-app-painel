export const environment = {
  production: false,
  stage: '',
  vercel: {
    isLocalUrl: false,
    baseUrl: '/api/routes',
  },
  srvCatra: {
    baseUrl: 'https://orcdev-cloud.adfcloud.com.br/srv-catra',
    tenantId: 'TENANT_ID_PRODUTION_HERE',
    apiKey: 'API_KEY_PRODUTION_HERE',
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
