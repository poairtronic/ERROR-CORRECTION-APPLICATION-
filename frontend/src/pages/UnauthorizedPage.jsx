import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';
import { Button } from '../components/ui/Button';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
        <FiLock size={48} />
      </div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">Access Denied</h1>
      <p className="text-slate-500 mb-8 max-w-md">
        You do not have the required permissions to view this page. If you believe this is an error, please contact your administrator.
      </p>
      <Button onClick={() => navigate('/')}>Return to Dashboard</Button>
    </div>
  );
}
