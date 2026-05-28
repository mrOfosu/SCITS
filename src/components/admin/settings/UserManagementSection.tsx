import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { Users, Search, Shield, Trash2 } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useReferenceData } from "@/hooks/useReferenceData";

interface UserProfile {
  id: string;
  display_name: string;
  email: string | null;
  faculty_id: string | null;
  department_id: string | null;
  profile_completed: boolean;
  role: AppRole;
}

const ASSIGNABLE_ROLES: { value: AppRole; label: string; needsDept?: boolean; needsFaculty?: boolean }[] = [
  { value: "student", label: "Student" },
  { value: "department_admin", label: "Department Admin", needsDept: true, needsFaculty: true },
  { value: "hod", label: "Head of Department (HOD)", needsDept: true, needsFaculty: true },
  { value: "faculty_admin", label: "Faculty Admin", needsFaculty: true },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_ORDER: AppRole[] = ["super_admin", "admin", "faculty_admin", "hod", "department_admin", "student"];

function highestRole(roles: string[]): AppRole {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return "student";
}

export default function UserManagementSection() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { faculties, departments } = useReferenceData();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("student");
  const [editFaculty, setEditFaculty] = useState<string>("");
  const [editDept, setEditDept] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, faculty_id, department_id, profile_completed")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const rolesByUser = new Map<string, string[]>();
    (roles || []).forEach((r: any) => {
      const list = rolesByUser.get(r.user_id) || [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    });

    setUsers(
      (profiles || []).map((p: any) => ({
        ...p,
        role: highestRole(rolesByUser.get(p.id) || []),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredDepartments = useMemo(
    () => departments.filter((d) => !editFaculty || d.faculty_id === editFaculty),
    [departments, editFaculty]
  );

  const openEdit = (user: UserProfile) => {
    setEditing(user);
    setEditRole(user.role);
    setEditFaculty(user.faculty_id || "");
    setEditDept(user.department_id || "");
  };

  const handleSave = async () => {
    if (!editing) return;
    const roleMeta = ASSIGNABLE_ROLES.find((r) => r.value === editRole);
    if (roleMeta?.needsFaculty && !editFaculty) {
      toast({ title: "Faculty required", description: "Select a faculty for this role.", variant: "destructive" });
      return;
    }
    if (roleMeta?.needsDept && !editDept) {
      toast({ title: "Department required", description: "Select a department for this role.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Replace roles: delete all existing, then insert new (skip insert for student)
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", editing.id);
      if (delErr) throw delErr;

      if (editRole !== "student") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert({ user_id: editing.id, role: editRole });
        if (insErr) throw insErr;
      }

      // 2. Update profile faculty/department for staff roles
      const profileUpdate: Record<string, string | null> = {};
      if (roleMeta?.needsFaculty || roleMeta?.needsDept) {
        profileUpdate.faculty_id = editFaculty || null;
        profileUpdate.department_id = editDept || null;
      }
      if (Object.keys(profileUpdate).length > 0) {
        const { error: profErr } = await supabase.from("profiles").update(profileUpdate).eq("id", editing.id);
        if (profErr) throw profErr;
      }

      // 3. Sync department_staff link for dept_admin / hod
      await supabase.from("department_staff").delete().eq("user_id", editing.id);
      if ((editRole === "department_admin" || editRole === "hod") && editDept) {
        const { error: dsErr } = await supabase
          .from("department_staff")
          .insert({ user_id: editing.id, department_id: editDept });
        if (dsErr) throw dsErr;
      }

      // 4. Clear out-of-scope notifications when role/scope changes so they
      //    don't see notifications from their previous role/faculty/department.
      const scopeChanged =
        editing.role !== editRole ||
        (editing.faculty_id || "") !== (editFaculty || "") ||
        (editing.department_id || "") !== (editDept || "");
      if (scopeChanged) {
        await supabase.from("notifications").delete().eq("user_id", editing.id);
      }

      toast({ title: "User updated", description: `${editing.display_name} is now ${roleMeta?.label}.` });
      setEditing(null);
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      toast({ title: "Cannot remove yourself", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      // Remove all access artifacts. Auth row remains but user has no profile/role/access.
      await supabase.from("notifications").delete().eq("user_id", deleteTarget.id);
      await supabase.from("department_staff").delete().eq("user_id", deleteTarget.id);
      await supabase.from("user_roles").delete().eq("user_id", deleteTarget.id);
      const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "User removed", description: `${deleteTarget.display_name} has been removed.` });
      setDeleteTarget(null);
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Remove failed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = users.filter(
    (u) =>
      (u.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const facultyName = (id: string | null) => faculties.find((f) => f.id === id)?.faculty_code || "—";
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.department_code || "—";

  const roleBadgeVariant = (role: AppRole) => {
    if (role === "super_admin" || role === "admin") return "default" as const;
    if (role === "student") return "secondary" as const;
    return "outline" as const;
  };

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Only Super Admins can manage user roles.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">User & Role Management</h2>
        <p className="text-sm text-muted-foreground">
          Assign roles and link staff to their faculty and department.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              All Users ({users.length})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading users...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Faculty</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.display_name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email || "—"}</TableCell>
                        <TableCell className="text-sm">{facultyName(user.faculty_id)}</TableCell>
                        <TableCell className="text-sm">{deptName(user.department_id)}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(user.role)} className="capitalize">
                            {user.role.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage {editing?.display_name}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(ASSIGNABLE_ROLES.find((r) => r.value === editRole)?.needsFaculty ||
              ASSIGNABLE_ROLES.find((r) => r.value === editRole)?.needsDept) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Faculty</label>
                <Select
                  value={editFaculty}
                  onValueChange={(v) => {
                    setEditFaculty(v);
                    setEditDept("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select faculty" />
                  </SelectTrigger>
                  <SelectContent>
                    {faculties.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.faculty_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {ASSIGNABLE_ROLES.find((r) => r.value === editRole)?.needsDept && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select value={editDept} onValueChange={setEditDept} disabled={!editFaculty}>
                  <SelectTrigger>
                    <SelectValue placeholder={editFaculty ? "Select department" : "Select faculty first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDepartments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.department_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
