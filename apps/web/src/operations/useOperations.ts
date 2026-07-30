import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { connectOperations, operationsApi, type Boat, type Trip } from './operationsApi';

export function useOperations() {
  const {session}=useAuth(); const [boats,setBoats]=useState<Boat[]>([]); const [trips,setTrips]=useState<Trip[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const reload=useCallback(async()=>{if(!session)return; try{setError(''); const [b,t]=await Promise.all([operationsApi.boats(session.accessToken),operationsApi.trips(session.accessToken)]);setBoats(b);setTrips(t);}catch(e){setError(e instanceof Error?e.message:'Unable to load operations.');}finally{setLoading(false);}},[session]);
  useEffect(()=>{void reload(); if(!session)return; const disconnect=connectOperations(session.accessToken,()=>void reload());const interval=window.setInterval(()=>void reload(),10000);return()=>{disconnect();window.clearInterval(interval)};},[reload,session]);
  return {boats,trips,loading,error,reload,token:session?.accessToken};
}
