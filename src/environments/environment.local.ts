export const environment = {
  production: false,
  stage: 'LOCAL',
  domainApp: {
    baseUrl: 'https://sisgca.adftecnologia.com.br',
  },
  vercel: {
    isLocalUrl: true,
    baseUrl: 'http://localhost:3001/api/routes',
  },
  srvCatra: {
    baseUrl: '/srv-catra',
    tenantId: 'sousacomercio',
    apiKey: '814992f817df60c0dfa104d42d3d19956060906b2de759813fb6e85e5fd2eca5',
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
