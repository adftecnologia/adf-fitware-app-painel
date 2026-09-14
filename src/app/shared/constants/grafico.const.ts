import { ChartConfiguration } from 'chart.js';

export const GRAFICO_PIZZA_DASHBOARD_CONFIG: ChartConfiguration = {
  type: 'doughnut',
  data: {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [
          '#4f46e5',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
        ],
        borderColor: '#ffffff',
        borderWidth: 0,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {},
  },
};

export const GRAFICO_BARRA_INDICANTE_DASHBOARD_CONFIG: ChartConfiguration = {
  type: 'bar',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Pessoas',
        data: [],
        backgroundColor: [
          '#4f46e5',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
        ],
        borderColor: ['#3730a3', '#059669', '#d97706', '#dc2626', '#7c3aed'],
        borderWidth: 1,
        borderRadius: 0,
        borderSkipped: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function (context) {
            // Mostra o nome completo no tooltip
            return context[0].label;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 100,
          callback: function (value, index, values) {
            const label = this.getLabelForValue(value as number);
            // Trunca labels com mais de 25 caracteres
            if (label && label.length > 25) {
              return label.substring(0, 25) + '...';
            }
            return label;
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  },
};

export const GRAFICO_BARRA_SECRETARIA_DASHBOARD_CONFIG: ChartConfiguration = {
  type: 'bar',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Pessoas',
        data: [],
        backgroundColor: [
          '#4f46e5',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
        ],
        borderColor: ['#3730a3', '#059669', '#d97706', '#dc2626', '#7c3aed'],
        borderWidth: 1,
        borderRadius: 0,
        borderSkipped: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: function (context) {
            // Mostra o nome completo no tooltip
            return context[0].label;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 100,
          callback: function (value, index, values) {
            const label = this.getLabelForValue(value as number);
            // Trunca labels com mais de 25 caracteres
            if (label && label.length > 25) {
              return label.substring(0, 25) + '...';
            }
            return label;
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  },
};
