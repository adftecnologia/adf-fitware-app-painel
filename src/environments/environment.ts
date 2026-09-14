export const environment = {
  production: false,
  stage: '',
  domainApp: {
    baseUrl: 'https://sisgca.adftecnologia.com.br',
  },
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
    apiKey: 'AIzaSyCDtWWgmwot-4wv5nJk1B55BxirnO2hRWc',
    authDomain: 'sgp-ma.firebaseapp.com',
    databaseURL: 'https://sgp-ma-default-rtdb.firebaseio.com',
    projectId: 'sgp-ma',
    storageBucket: 'sgp-ma.firebasestorage.app',
    messagingSenderId: '732648300189',
    appId: '1:732648300189:web:44036341b521f490ce3e74',
  },
};
