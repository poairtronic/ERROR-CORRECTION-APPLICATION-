import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  withCredentials: true,
});

// Response Interceptor: Global Error Handling & Auto-Logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ecr_user');
      window.dispatchEvent(new Event('auth-expired'));
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.');
    }

    return Promise.reject(error);
  }
);

export default api;
