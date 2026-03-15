import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  signup: (data: { full_name: string; email: string; phone: string; password: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

// Contacts APIs
export const contactsAPI = {
  getAll: () => api.get('/contacts'),
  add: (data: { name: string; phone: string; relationship?: string }) =>
    api.post('/contacts', data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
};

// SOS APIs
export const sosAPI = {
  create: (data: { location_lat: number; location_lng: number; alert_type?: string }) =>
    api.post('/sos', data),
  cancel: (id: string) => api.put(`/sos/${id}/cancel`),
  getActive: () => api.get('/sos/active'),
};

// Incident APIs
export const incidentAPI = {
  create: (data: any) => api.post('/incidents', data),
  getMy: () => api.get('/incidents/my'),
  get: (id: string) => api.get(`/incidents/${id}`),
};

// Escort APIs
export const escortAPI = {
  create: (data: any) => api.post('/escorts', data),
  getActive: () => api.get('/escorts/active'),
  cancel: (id: string) => api.put(`/escorts/${id}/cancel`),
  assign: (id: string) => api.put(`/escorts/${id}/assign`),
};

// Friend Walk APIs
export const friendWalkAPI = {
  start: (data: { contact_ids: string[]; duration_minutes: number; location_lat: number; location_lng: number }) =>
    api.post('/friend-walk', data),
  getActive: () => api.get('/friend-walk/active'),
  updateLocation: (id: string, data: { location_lat: number; location_lng: number }) =>
    api.put(`/friend-walk/${id}/update`, data),
  extend: (id: string, minutes: number) => api.put(`/friend-walk/${id}/extend?minutes=${minutes}`),
  complete: (id: string) => api.put(`/friend-walk/${id}/complete`),
};

// Alerts APIs
export const alertsAPI = {
  getAll: () => api.get('/alerts'),
  get: (id: string) => api.get(`/alerts/${id}`),
};

// Locations APIs
export const locationsAPI = {
  getAll: (type?: string) => api.get('/locations', { params: { location_type: type } }),
};

// Seed data
export const seedData = () => api.post('/seed');

export default api;
