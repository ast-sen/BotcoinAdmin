import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { Admin } from '../types/admin.types';

interface AuthContextType {
  admin: Admin | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchAdminProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchAdminProfile(session.user.id);
      } else {
        setAdmin(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

const fetchAdminProfile = async (userId: string) => {
    try {
      // Debug: Log the user ID we're looking for
      console.log('🔍 Looking for admin with ID:', userId);
      
      // First, let's see what's actually in the admins table
      const { data: allAdmins, error: listError } = await supabase
        .from('admins')
        .select('*');
      
      console.log('📋 All admins in table:', allAdmins);
      console.log('❓ List error:', listError);
      
      // Now try to find the specific admin
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('id', userId);
      
      console.log('🎯 Query result:', data);
      console.log('🔍 Query error:', error);
      
      if (error) {
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log('💡 No admin found with ID:', userId);
        console.log('💡 Available admin IDs:', allAdmins?.map(a => a.id));
        return;
      }
      
      // If we found exactly one admin, use it
      if (data.length === 1) {
        setAdmin(data[0]);
        console.log('✅ Admin profile found:', data[0]);
      } else {
        console.log('⚠️ Multiple admins found, using first one');
        setAdmin(data[0]);
      }
      
    } catch (error) {
      console.error('❌ Error fetching admin profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};