export interface User {
  id: string;
  email: string;
  full_name: string;         
  phone_number?: string;
  gcash_number?: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  member_since?: string;
  created_at?: string;
  updated_at?: string;
  status: "active" | "inactive";
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  gcash_number?: string;
  total_points: number;
  available_points: number;
  redeemed_points: number;
  tier: string;
  member_since: string;
  created_at: string;
  updated_at: string;
  member_number: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  created_at: string;
  read: boolean;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'earned' | 'redeemed' | 'bonus';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  reference_id?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface RedemptionRequest {
  id: string;
  user_id: string;
  account_id: string;
  full_name: string;
  gcash_number: string;
  points_redeemed: number;
  cash_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  processed_at?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}


export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin';
}