import { UserListPage, type UserViewRow } from "@/features/admin/admin-pages";
import { getUsers } from "@/features/admin/data/admin-api";

export default async function AdminUsersRoute() {
  let rows: UserViewRow[] = [];
  let unavailable = false;
  try {
    rows = await getUsers();
  } catch {
    unavailable = true;
  }
  return <UserListPage rows={rows} unavailable={unavailable} />;
}
