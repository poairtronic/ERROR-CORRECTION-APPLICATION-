import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
});

// Request Interceptor: Attach Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ecr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global Error Handling & Auto-Logout
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Check if error is due to an unauthorized token
    if (error.response?.status === 401) {
      // Clear token and force reload to kick user to login page
      // We don't use React Router here to avoid circular dependencies
      localStorage.removeItem('ecr_token');
      localStorage.removeItem('ecr_user');
      window.dispatchEvent(new Event('auth-expired'));
    } else if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
