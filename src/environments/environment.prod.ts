export const environment = {
  production: true,
  stage: 'PROD',
  domainApp: {
    baseUrl: 'https://sisgca.adftecnologia.com.br',
  },
  vercel: {
    isLocalUrl: false,
    baseUrl: '/api/routes',
  },
  srvCatra: {
    baseUrl: 'https://orcprod-cloud.adfcloud.com.br/srv-catra',
    tenantId: 'TENANT_ID_PRODUTION_HERE',
    apiKey: 'API_KEY_PRODUTION_HERE',
  },
  firebase: {
    apiKey: 'AIzaSyBA3Qr4YpPw1lLlxMUp0PErx-7GuZT1B5Y',
    authDomain: 'adf-sousacomercio-app-sgca.firebaseapp.com',
    databaseURL:
      'https://adf-sousacomercio-app-sgca-default-rtdb.firebaseio.com',
    projectId: 'adf-sousacomercio-app-sgca',
    storageBucket: 'adf-sousacomercio-app-sgca.firebasestorage.app',
    messagingSenderId: '720094852862',
    appId: '1:720094852862:web:3db89f2274aed17ffc97af',
  },
};
