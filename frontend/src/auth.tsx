import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, setAccessToken, unwrap } from "./api";

export type Role = "PLATFORM_ADMIN" | "ORGANIZATION_ADMIN" | "MANAGER" | "STAFF";
export interface User { id?: string; _id?: string; firstName:string; lastName:string; email:string; phone?:string; role:Role; organizationId?:string; managerId?:string; jobTitle?:string; department?:string; isActive?:boolean; lastLoginAt?:string; createdAt?:string; }
export interface RegisterData { firstName:string; lastName:string; email:string; phone?:string; password:string; }
interface AuthResponse { user?:User; accessToken?:string; token?:string; mfaRequired?:boolean; mfaChallengeToken?:string; }
export class MfaRequiredError extends Error { challengeToken:string; constructor(token:string){super("MFA verification required");this.name="MfaRequiredError";this.challengeToken=token;} }
interface AuthContextValue { user:User|null; loading:boolean; login:(email:string,password:string)=>Promise<void>; verifyMfaLogin:(challenge:string,code:string)=>Promise<void>; register:(data:RegisterData)=>Promise<void>; logout:()=>Promise<void>; refreshUser:()=>Promise<void>; isAdmin:boolean; isPlatformAdmin:boolean; isOrganizationAdmin:boolean; isManager:boolean; isStaff:boolean; userId:string|undefined; }
const AuthContext=createContext<AuthContextValue|null>(null);
function extract(response:AuthResponse|User){const data=response as AuthResponse;return {user:data.user??(response as User),token:data.accessToken??data.token};}
export function AuthProvider({children}:{children:ReactNode}){const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const userId=user?.id??user?._id;const isPlatformAdmin=user?.role==="PLATFORM_ADMIN";const isOrganizationAdmin=user?.role==="ORGANIZATION_ADMIN";const isAdmin=isPlatformAdmin||isOrganizationAdmin;const isManager=user?.role==="MANAGER";const isStaff=user?.role==="STAFF";
 const refreshUser=async()=>{const response=await api.get("/auth/me");setUser(unwrap<User>(response));};
 useEffect(()=>{let mounted=true;(async()=>{try{const response=await api.get("/auth/me");if(mounted)setUser(unwrap<User>(response));}catch{if(mounted)setUser(null);}finally{if(mounted)setLoading(false);}})();return()=>{mounted=false}},[]);
 const login=async(email:string,password:string)=>{const data=unwrap<AuthResponse>(await api.post("/auth/login",{email,password}));if(data.mfaRequired&&data.mfaChallengeToken)throw new MfaRequiredError(data.mfaChallengeToken);const x=extract(data);if(!x.user)throw new Error("Authentication succeeded but no user was returned.");if(x.token)setAccessToken(x.token);setUser(x.user);};
 const verifyMfaLogin=async(challenge:string,code:string)=>{const data=unwrap<AuthResponse>(await api.post("/infrastructure/mfa/verify-login",{challenge,code}));const x=extract(data);if(!x.user||!x.token)throw new Error("MFA verification did not return a valid session.");setAccessToken(x.token);setUser(x.user);};
 const register=async(data:RegisterData)=>{const result=unwrap<AuthResponse>(await api.post("/auth/register",data));const x=extract(result);if(!x.user)throw new Error("Registration succeeded but no user was returned.");if(x.token)setAccessToken(x.token);setUser(x.user);};
 const logout=async()=>{try{await api.post("/auth/logout");}finally{setAccessToken(null);setUser(null);}};
 const value=useMemo(()=>({user,loading,login,verifyMfaLogin,register,logout,refreshUser,isAdmin,isPlatformAdmin,isOrganizationAdmin,isManager,isStaff,userId}),[user,loading,isAdmin,isPlatformAdmin,isOrganizationAdmin,isManager,isStaff,userId]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error("useAuth must be used inside AuthProvider");return context;}
