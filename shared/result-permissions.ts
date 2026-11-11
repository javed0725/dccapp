export type ResultPermissionUser = { role?: string; isAuthority?: boolean } | null | undefined;

/** Authority privileges exclude mark-entry privileges, regardless of selected panel. */
export function getResultPermissions(user: ResultPermissionUser) {
  const canManageStructure = !!user && (user.role === "admin" || user.isAuthority === true);
  return {
    canManageStructure,
    canEnterMarks: !!user && user.role === "teacher" && !canManageStructure,
  };
}

export function canEnterDraftMarks(user: ResultPermissionUser, draft: { status: string } | null | undefined) {
  return getResultPermissions(user).canEnterMarks && draft?.status === "draft";
}

export function visibleResultDrafts<T extends { status: string }>(user: ResultPermissionUser, drafts: T[]) {
  const permissions = getResultPermissions(user);
  return permissions.canManageStructure ? drafts : permissions.canEnterMarks
    ? drafts.filter((draft) => draft.status === "draft") : [];
}
