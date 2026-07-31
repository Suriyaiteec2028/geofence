import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hospital_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('hospital_token') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const login = async (usernameOrEmail, password, role) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { usernameOrEmail, password, role });
      if (response.data.success) {
        const { token: newToken, user: userData } = response.data;
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('hospital_token', newToken);
        localStorage.setItem('hospital_user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setLoading(false);
        return { success: true, role: userData.role };
      }
    } catch (err) {
      setLoading(false);
      return { 
        success: false, 
        message: err.response?.data?.message || 'Login failed. Please check your credentials.' 
      };
    }
  };

  const doctorFaceLogin = async (usernameOrEmail, password, liveFaceData) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/doctor-face-login', { usernameOrEmail, password, liveFaceData });
      if (response.data.success) {
        const { token: newToken, user: userData } = response.data;
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('hospital_token', newToken);
        localStorage.setItem('hospital_user', JSON.stringify(userData));
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setLoading(false);
        return { success: true, role: 'DOCTOR', message: response.data.message };
      }
    } catch (err) {
      setLoading(false);
      return { 
        success: false, 
        message: err.response?.data?.message || 'Biometric authentication failed.' 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('hospital_token');
    localStorage.removeItem('hospital_user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateProfileState = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('hospital_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, role: user?.role, loading, login, doctorFaceLogin, logout, updateProfileState }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
