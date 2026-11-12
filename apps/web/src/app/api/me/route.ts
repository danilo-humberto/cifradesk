import { preferencesInput } from '@cifradesk/contracts/identity';
import { currentUser, saveTheme, revokeAll } from '@/lib/server/identity';
import { body, failure, json, sameOrigin } from '@/lib/server/http';
export async function GET(request: Request) {
  try {
    const user = await currentUser(request.headers);
    return json({ id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin, theme: user.theme });
  } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser(request.headers);
    await saveTheme(user.id, preferencesInput.parse(await body(request)).theme);
    return json({ ok: true });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try { sameOrigin(request); await revokeAll((await currentUser(request.headers)).id); return json({ ok: true }); }
  catch (error) { return failure(error); }
}
