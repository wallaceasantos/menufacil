import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import type { PlanType } from '../data/plans';
import { api } from '../lib/api';
import type { ApiUser } from '../types';

interface User {
  id: string;
  name: string;
  email: string;
  plan?: PlanType;
  role?: 'admin' | 'tenant';
  paymentStatus?: 'paid' | 'overdue';
  overdueDays?: number;
  tenantId?: string | null;
  tenantSlug?: string;
  subscriptionStatus?: string;
  cardLastFour?: string | null;
  nextBillingDate?: string | null;
  tenantRole?: string;
  ownerCpfCnpj?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingPostalCode?: string | null;
  billingAddressNumber?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapApiUser(apiUser: ApiUser): User {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    plan: apiUser.plan,
    paymentStatus: apiUser.paymentStatus,
    overdueDays: apiUser.overdueDays,
    tenantId: apiUser.tenantId,
    tenantSlug: apiUser.tenantSlug,
    subscriptionStatus: apiUser.subscriptionStatus,
    cardLastFour: apiUser.cardLastFour,
    nextBillingDate: apiUser.nextBillingDate,
    tenantRole: apiUser.tenantRole,
    ownerCpfCnpj: apiUser.ownerCpfCnpj,
    ownerFirstName: apiUser.ownerFirstName,
    ownerLastName: apiUser.ownerLastName,
    billingEmail: apiUser.billingEmail,
    billingPhone: apiUser.billingPhone,
    billingPostalCode: apiUser.billingPostalCode,
    billingAddressNumber: apiUser.billingAddressNumber,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = sessionStorage.getItem('jwt_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api<{ user: ApiUser }>('/auth/me');
        setUser(mapApiUser(data.user));
      } catch {
        sessionStorage.removeItem('jwt_token');
        sessionStorage.removeItem('user_data');
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = (token: string, user: User) => {
    sessionStorage.setItem('jwt_token', token);
    sessionStorage.setItem('user_data', JSON.stringify(user));
    setUser(user);
  };

  const updateUser = (updatedUser: User) => {
    sessionStorage.setItem('user_data', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = () => {
    sessionStorage.removeItem('jwt_token');
    sessionStorage.removeItem('user_data');
    setUser(null);
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
