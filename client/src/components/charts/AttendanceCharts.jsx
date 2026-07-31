import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const MonthlyTrendChart = ({ trends }) => {
  const labels = trends?.map((t) => t.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const values = trends?.map((t) => t.percentage) || [92, 88, 95, 91, 94, 96, 93];

  const data = {
    labels,
    datasets: [
      {
        label: 'Attendance Compliance %',
        data: values,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#FFFFFF',
        pointHoverRadius: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        titleColor: '#F8FAFC',
        bodyColor: '#38BDF8',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
      y: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94A3B8' }, min: 50, max: 100 }
    }
  };

  return (
    <div className="h-64 w-full">
      <Line data={data} options={options} />
    </div>
  );
};

export const PHCPerformanceChart = ({ phcs }) => {
  const labels = phcs?.map((p) => p.name.substring(0, 15) + '...') || ['Central PHC', 'North Clinic', 'East Wellness'];
  const values = phcs?.map((p) => p.attendanceRate) || [95, 88, 92];

  const data = {
    labels,
    datasets: [
      {
        label: 'Compliance Rate %',
        data: values,
        backgroundColor: ['#3B82F6', '#0EA5E9', '#10B981'],
        borderRadius: 8
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
      y: { grid: { color: 'rgba(51, 65, 85, 0.4)' }, ticks: { color: '#94A3B8' }, min: 0, max: 100 }
    }
  };

  return (
    <div className="h-64 w-full">
      <Bar data={data} options={options} />
    </div>
  );
};

export const DoctorStatusDoughnut = ({ present = 4, absent = 1, pending = 1 }) => {
  const data = {
    labels: ['Present', 'Absent', 'Pending Explanation'],
    datasets: [
      {
        data: [present, absent, pending],
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
        borderColor: '#1E293B',
        borderWidth: 3
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 11 } } }
    },
    cutout: '70%'
  };

  return (
    <div className="h-56 w-full flex items-center justify-center">
      <Doughnut data={data} options={options} />
    </div>
  );
};
