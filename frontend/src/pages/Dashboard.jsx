import { useAuth } from '../contexts/AuthContext';
import OperatorDashboard from './dashboards/OperatorDashboard';
import InspectorDashboard from './dashboards/InspectorDashboard';
import SeniorManagerDashboard from './dashboards/SeniorManagerDashboard';
import GeneralManagerDashboard from './dashboards/GeneralManagerDashboard';
import StoreManagerDashboard from './dashboards/StoreManagerDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import SalesDashboard from './dashboards/SalesDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  
  if (!user) return null;

  switch (user.role?.toUpperCase()) {
    case 'OPERATOR': return <OperatorDashboard />;
    case 'INSPECTOR': return <InspectorDashboard />;
    case 'SENIOR_MANAGER': return <SeniorManagerDashboard />;
    case 'GENERAL_MANAGER': return <GeneralManagerDashboard />;
    case 'STORE_MANAGER': return <StoreManagerDashboard />;
    case 'ADMIN': return <AdminDashboard />;
    case 'SALES': return <SalesDashboard />;
    default: return <OperatorDashboard />;
  }
}
