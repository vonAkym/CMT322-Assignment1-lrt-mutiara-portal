// Simulated staff sign-in: one switch that shows or hides the staff pages. It is kept for this browser tab,
// so refreshing a staff page does not sign you out.
// Module 4 replaces this with real Supabase sign-in (signIn and myProfile in modules/admin/api.js).
import { createContext, useContext, useState } from 'react';

const KEY = 'staffDemo';
const StaffContext = createContext(null);

export function StaffProvider({ children }) {
  const [staff, setStaffState] = useState(() => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } });
  const setStaff = (on) => {
    setStaffState(on);
    try { if (on) sessionStorage.setItem(KEY, '1'); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
  };
  return <StaffContext.Provider value={{ staff, setStaff }}>{children}</StaffContext.Provider>;
}

export const useStaff = () => useContext(StaffContext);
