import { assertAdmin } from '@cifradesk/core';
import { pageInput, membershipInput } from '@cifradesk/contracts/identity';
import { currentUser, createIdentity, updateIdentity, resendInvitation, createDepartment, updateDepartment, setMembership, listUsers, listDepartments, listMembers, limitAttempts } from '@/lib/server/identity';
import { body, failure, json, sameOrigin } from '@/lib/server/http';

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    const user = await currentUser(request.headers);
    assertAdmin(user);
    const { path } = await context.params;
    const [resource, id, action, memberId] = path;
    const page = pageInput.parse(new URL(request.url).searchParams.get('page') ?? 1);
    if (request.method === 'GET') {
      if (path.length === 1 && resource === 'users') return json(await listUsers(page));
      if (path.length === 1 && resource === 'departments') return json(await listDepartments(page));
      if (path.length === 3 && resource === 'departments' && id && action === 'members') return json(await listMembers(id, page));
      return json({ error: 'Não encontrado.' }, 404);
    }
    sameOrigin(request);
    await limitAttempts('admin:' + user.id, 60);
    const data = await body(request);
    if (resource === 'users' && path.length === 1 && request.method === 'POST') return json(await createIdentity(user.id, data), 201);
    if (resource === 'users' && path.length === 2 && id && request.method === 'PATCH') return json(await updateIdentity(user.id, id, data));
    if (resource === 'users' && path.length === 3 && id && action === 'resend' && request.method === 'POST') {
      await resendInvitation(user.id, id); return json({ ok: true });
    }
    if (resource === 'departments' && path.length === 1 && request.method === 'POST') return json(await createDepartment(user.id, data), 201);
    if (resource === 'departments' && path.length === 2 && id && request.method === 'PATCH') return json(await updateDepartment(user.id, id, data));
    if (resource === 'departments' && id && action === 'members') {
      if (path.length === 3 && request.method === 'POST') {
        await setMembership(user.id, id, membershipInput.parse(data).userId, true); return json({ ok: true });
      }
      if (path.length === 4 && memberId && request.method === 'DELETE') {
        await setMembership(user.id, id, memberId, false); return json({ ok: true });
      }
    }
    return json({ error: 'Não encontrado.' }, 404);
  } catch (error) { return failure(error); }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
