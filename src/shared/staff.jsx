// Staff sign-in (Module 4, UC01): who is signed in, and whether they are staff.
// Supabase keeps the session in this browser, so a refresh or a new tab stays signed in until Sign out.
// Any page can call useStaff() to read { ready, user, profile, staff } or to call signIn() and signOut().
import { createContext, useContext, useEffect, useState } from 'react';
import { sb } from './supabase.js';
import { myProfile, signIn as apiSignIn, signOut as apiSignOut } from '../modules/admin/api.js';

// The roles the database treats as staff (public.is_staff()). Residents and business owners are not staff.
export const STAFF_ROLES = ['admin', 'construction', 'government'];
export const ROLE_NAMES = { admin: 'Admin', construction: 'Construction Team', government: 'Government Officer' };

const StaffContext = createContext(null);

export function StaffProvider({ children }) {
  // ready is false until the saved session has been checked, so staff pages do not bounce to the login page on refresh.
  const [state, setState] = useState({ ready: false, user: null, profile: null });

  useEffect(() => {
    let live = true;
    const load = async (user) => {
      let profile = null;
      if (user) {
        try { profile = await myProfile(); } catch (e) { console.error(e); }
      }
      if (live) setState({ ready: true, user, profile });
    };
    // Runs once with the saved session, then on every sign-in and sign-out (in this tab or another).
    // Supabase warns against awaiting its own calls inside this callback, so the profile loads just after it.
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return; // same person, nothing to reload
      setTimeout(() => load(session?.user ?? null), 0);
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  const staff = !!state.profile && STAFF_ROLES.includes(state.profile.role);

  // Signs in, then checks the account is staff. A resident account is signed out again straight away.
  const signIn = async (email, password) => {
    const { user } = await apiSignIn(email.trim(), password);
    const profile = await myProfile();
    if (!profile || !STAFF_ROLES.includes(profile.role)) {
      await apiSignOut();
      throw new Error('This account is not a staff account. Ask an admin to give it a staff role.');
    }
    // Known now, so the staff page opens straight away instead of waiting for the sign-in event.
    setState({ ready: true, user, profile });
    return profile;
  };

  const signOut = async () => { await apiSignOut(); };

  return <StaffContext.Provider value={{ ...state, staff, signIn, signOut }}>{children}</StaffContext.Provider>;
}

export const useStaff = () => useContext(StaffContext);
