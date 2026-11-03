import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from '@/lib/domain';
export function ok(value: unknown, status = 200) { return NextResponse.json(value,{ status, headers: { 'Cache-Control': 'private, no-store' } }); }
export function fail(error: unknown) {
  if (error instanceof AppError) return ok({ error: { code: error.code, message: error.message } },error.status);
  if (error instanceof ZodError) return ok({ error: { code:'VALIDATION_ERROR',message:'Verificați câmpurile completate.',fields:error.issues.map(i => ({ path:i.path.join('.'), message:i.message })) } },422);
  if (error instanceof SyntaxError) return ok({ error:{ code:'INVALID_JSON',message:'Cererea nu este validă.' } },400);
  // Log only the error type/code, never queries, payloads, keys or patient content.
  console.error('API_ERROR', error instanceof Error ? error.name : 'Unknown');
  return ok({ error:{code:'SERVER_ERROR',message:'Serviciul este temporar indisponibil. Încercați din nou.'} },503);
}
